import { NextRequest, NextResponse } from "next/server";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SERVICE_SCOPE = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";

const parseServiceAccount = () => {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!raw) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
    }
    try {
        return JSON.parse(raw) as {
            client_email: string;
            private_key: string;
        };
    } catch {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON");
    }
};

const base64UrlEncode = (input: string | ArrayBuffer) => {
    const buffer =
        typeof input === "string"
            ? Buffer.from(input)
            : new Uint8Array(input);
    const base64 = Buffer.from(buffer).toString("base64");
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const pemToArrayBuffer = (pem: string) => {
    const body = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\s+/g, "");
    const buf = Buffer.from(body, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
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
        ["sign"]
    );
    const signature = await crypto.subtle.sign(
        { name: "RSASSA-PKCS1-v1_5" },
        cryptoKey,
        data
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
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    const json = (await response.json()) as { access_token?: string; error?: string };
    if (!response.ok || !json.access_token) {
        throw new Error(json.error || "Failed to fetch access token");
    }
    return json.access_token;
};

/**
 * Create a new spreadsheet via service account
 * POST /api/sheets/create
 * Body: { title: string }
 */
export async function POST(request: NextRequest) {
    let body: { title?: string };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const title = body.title?.trim() || "Untitled Spreadsheet";

    try {
        const token = await getServiceAccountToken();

        // Create a new spreadsheet
        const response = await fetch(`${SHEETS_API_BASE}/spreadsheets`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                properties: {
                    title,
                },
                sheets: [
                    {
                        properties: {
                            title: "Sheet1",
                        },
                    },
                ],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Create spreadsheet error:", errorText);
            return NextResponse.json(
                { error: "Failed to create spreadsheet", details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json() as {
            spreadsheetId: string;
            spreadsheetUrl: string;
            properties: { title: string };
        };

        return NextResponse.json({
            ok: true,
            spreadsheetId: data.spreadsheetId,
            title: data.properties.title,
            url: data.spreadsheetUrl,
        });
    } catch (error) {
        console.error("Create spreadsheet error:", error);
        return NextResponse.json(
            { error: "Failed to create spreadsheet", details: String(error) },
            { status: 500 }
        );
    }
}
