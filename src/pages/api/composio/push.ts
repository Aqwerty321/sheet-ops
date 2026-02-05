import { route } from "rwsdk/router";

const COMPOSIO_API_KEY = "ak_duib7fFMFxL8Dpwdl3PQ";

interface CellUpdate {
  row: number;
  col: number;
  value: string;
}

/**
 * Push changes to Google Sheets via Composio
 */
export default route("/api/composio/push", {
  post: async ({ request }) => {
    let body: {
      userId?: string;
      sheetId?: string;
      sheetName?: string;
      connectedAccountId?: string;
      updates?: CellUpdate[];
      fullData?: string[][];
    };

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const userId = body.userId || "anonymous";
    const sheetId = body.sheetId;
    const sheetName = body.sheetName || "Sheet1"; // Default to Sheet1

    console.log("Push request:", { userId, sheetId, sheetName, hasConnectedAccountId: !!body.connectedAccountId, hasFullData: !!body.fullData, dataRows: body.fullData?.length });

    if (!sheetId) {
      return Response.json({ error: "sheetId required" }, { status: 400 });
    }

    try {
      // Build the request body - use connectedAccountId if available
      const buildRequestBody = (input: Record<string, unknown>) => {
        if (body.connectedAccountId) {
          console.log("Using connectedAccountId:", body.connectedAccountId);
          return { connectedAccountId: body.connectedAccountId, input };
        }
        console.log("Using entityId + appName:", userId);
        return { entityId: userId, appName: "googlesheets", input };
      };

      // If full data provided, do a batch update (overwrite existing data)
      if (body.fullData && body.fullData.length > 0) {
        // Include sheet name in range for clarity
        const range = `${sheetName}!A1:${columnToLetter(body.fullData[0]?.length || 1)}${body.fullData.length}`;
        console.log("Update range:", range);
        
        // First, clear the sheet to avoid appending
        console.log("Clearing sheet first...");
        const clearResponse = await fetch(
          "https://backend.composio.dev/api/v2/actions/GOOGLESHEETS_CLEAR_VALUES/execute",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": COMPOSIO_API_KEY,
            },
            body: JSON.stringify(
              buildRequestBody({
                spreadsheet_id: sheetId,
                range: `${sheetName}!A1:Z1000`,
              })
            ),
          },
        );
        
        const clearText = await clearResponse.text();
        console.log("Clear response:", clearResponse.status, clearText.slice(0, 200));
        
        // Now write the data using BATCH_UPDATE
        const response = await fetch(
          "https://backend.composio.dev/api/v2/actions/GOOGLESHEETS_BATCH_UPDATE/execute",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": COMPOSIO_API_KEY,
            },
            body: JSON.stringify(
              buildRequestBody({
                spreadsheet_id: sheetId,
                sheet_name: sheetName,
                range,
                values: body.fullData,
                value_input_option: "RAW",
              })
            ),
          },
        );

        const responseText = await response.text();
        console.log("Composio batch update response:", response.status, responseText.slice(0, 500));

        if (!response.ok) {
          console.error("Failed to push full data:", responseText);
          return Response.json(
            { error: "Failed to push changes", details: responseText },
            { status: response.status },
          );
        }

        return Response.json({ ok: true, updated: body.fullData.length });
      }

      // Individual cell updates
      if (body.updates && body.updates.length > 0) {
        const data = body.updates.map((update) => ({
          range: `${columnToLetter(update.col)}${update.row}`,
          values: [[update.value]],
        }));

        const response = await fetch(
          "https://backend.composio.dev/api/v2/actions/GOOGLESHEETS_BATCH_UPDATE_VALUES/execute",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": COMPOSIO_API_KEY,
            },
            body: JSON.stringify(
              buildRequestBody({
                spreadsheet_id: sheetId,
                data,
                value_input_option: "RAW",
              })
            ),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to push updates:", errorText);
          return Response.json(
            { error: "Failed to push changes", details: errorText },
            { status: response.status },
          );
        }

        return Response.json({ ok: true, updated: body.updates.length });
      }

      return Response.json({ error: "No updates provided" }, { status: 400 });
    } catch (error) {
      console.error("Push error:", error);
      return Response.json(
        { error: "Failed to push changes" },
        { status: 500 },
      );
    }
  },
});

function columnToLetter(col: number): string {
  let result = "";
  let n = col;
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result || "A";
}
