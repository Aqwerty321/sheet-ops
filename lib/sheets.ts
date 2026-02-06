// NOTE: Set GOOGLE_SERVICE_ACCOUNT_KEY to the JSON string of a service account key.
// TODO: Store this securely (Cloudflare secrets / env vars), never commit it.

export type AuthContext =
  | { type: "service" }
  | { type: "oauth"; accessToken: string; refreshToken?: string };

export type EditOperation = {
  id: string;
  type: "cell_update" | "row_delete" | "add_row";
  rowId?: string;
  columnId?: string;
  oldValue?: string;
  newValue?: string;
  author: "user" | "agent";
};

const SERVICE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4";

const parseServiceAccount = () => {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY is not set. Provide a stringified service account JSON.",
    );
  }
  try {
    return JSON.parse(raw) as {
      client_email: string;
      private_key: string;
    };
  } catch (error) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.");
  }
};

const base64UrlEncode = (input: string | ArrayBuffer) => {
  const buffer =
    typeof input === "string"
      ? typeof Buffer !== "undefined"
        ? Buffer.from(input)
        : new TextEncoder().encode(input)
      : new Uint8Array(input);
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(buffer).toString("base64")
      : btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const pemToArrayBuffer = (pem: string) => {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(body, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const signJwt = async (email: string, privateKey: string, scope: string) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 60 * 60,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const keyData = pemToArrayBuffer(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    cryptoKey,
    data,
  );
  const encodedSignature = base64UrlEncode(signature);
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
};

const getServiceAccountToken = async () => {
  const key = parseServiceAccount();
  const assertion = await signJwt(key.client_email, key.private_key, SERVICE_SCOPE);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error || "Failed to fetch access token");
  }
  return json.access_token;
};

const getAuthHeader = async (auth: AuthContext) => {
  if (auth.type === "service") {
    const token = await getServiceAccountToken();
    return `Bearer ${token}`;
  }
  return `Bearer ${auth.accessToken}`;
};

const columnIdToLetter = (columnId?: string) => {
  if (!columnId) return "A";
  if (/^[A-Z]$/i.test(columnId)) return columnId.toUpperCase();
  // TODO: map column IDs by header order instead of hardcoding
  if (columnId === "name") return "A";
  if (columnId === "email") return "B";
  if (columnId === "amount") return "C";
  return "A";
};

const rowIdToNumber = (rowId?: string) => {
  if (!rowId) return 1;
  const match = rowId.match(/\d+/);
  return match ? Number(match[0]) : 1;
};

export const executeOperations = async (
  auth: AuthContext,
  sheetId: string,
  ops: EditOperation[],
) => {
  if (!ops.length) {
    return { applied: 0, simulated: true };
  }

  if (auth.type === "service") {
    const data = ops
      .filter(
        (op) => op.type === "cell_update" && op.rowId && op.columnId,
      )
      .map((op) => {
        const column = columnIdToLetter(op.columnId);
        const row = rowIdToNumber(op.rowId);
        return {
          range: `${column}${row}`,
          values: [[op.newValue ?? ""]],
        };
      });

    if (!data.length) {
      // TODO: implement row_delete/add_row and batching
      return { applied: 0, simulated: true };
    }

    try {
      const authHeader = await getAuthHeader(auth);
      const response = await fetch(
        `${SHEETS_API_BASE}/spreadsheets/${sheetId}/values:batchUpdate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({
            valueInputOption: "RAW",
            data,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Batch update failed (${response.status})`);
      }
      return { applied: data.length, simulated: false };
    } catch (error) {
      console.error("Sheets batchUpdate failed", error);
      // TODO: add robust error handling and retries
      return { applied: 0, simulated: true, error: "Batch update failed" };
    }
  }

  // OAuth mode stub
  console.log("Simulating OAuth execution", { sheetId, ops });
  // TODO: implement OAuth-backed execution and batching
  return { applied: ops.length, simulated: true };
};

export const fetchSheetValues = async (auth: AuthContext, sheetId: string) => {
  try {
    const authHeader = await getAuthHeader(auth);
    const response = await fetch(
      `${SHEETS_API_BASE}/spreadsheets/${sheetId}/values/A1:Z1000`,
      {
        headers: {
          Authorization: authHeader,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Sheets values.get failed (${response.status})`);
    }
    const json = (await response.json()) as { values?: string[][] };
    const values = json.values ?? [];
    return { values };
  } catch (error) {
    console.error("Sheets values.get failed", error);
    throw new Error("Failed to fetch sheet data");
  }
};