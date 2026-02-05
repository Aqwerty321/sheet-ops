import { route } from "rwsdk/router";

const COMPOSIO_API_KEY = "ak_duib7fFMFxL8Dpwdl3PQ";

/**
 * Get sheet tabs (worksheets) for a spreadsheet
 * 
 * Note: We try multiple Composio actions to get spreadsheet metadata.
 * If none work, we fall back to parsing the range from a BATCH_GET response.
 */
export default route("/api/composio/sheet-tabs", {
  get: async ({ request }) => {
    const url = new URL(request.url);
    const spreadsheetId = url.searchParams.get("spreadsheetId");
    const connectedAccountId = url.searchParams.get("connectedAccountId");
    const userId = url.searchParams.get("userId") || "anonymous";

    if (!spreadsheetId) {
      return Response.json({ error: "spreadsheetId required" }, { status: 400 });
    }

    console.log("Fetching sheet tabs for:", spreadsheetId, "accountId:", connectedAccountId);

    try {
      // Try GOOGLESHEETS_GET_SPREADSHEET_INFO action first
      const response = await fetch(
        "https://backend.composio.dev/api/v2/actions/GOOGLESHEETS_GET_SPREADSHEET_INFO/execute",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": COMPOSIO_API_KEY,
          },
          body: JSON.stringify(
            connectedAccountId
              ? {
                  connectedAccountId,
                  input: {
                    spreadsheet_id: spreadsheetId,
                  },
                }
              : {
                  entityId: userId,
                  appName: "googlesheets",
                  input: {
                    spreadsheet_id: spreadsheetId,
                  },
                }
          ),
        }
      );

      const responseText = await response.text();
      console.log("Get spreadsheet info response:", response.status, responseText.slice(0, 800));

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          // Try to extract sheets from the response
          const sheets = data.data?.sheets || data.data?.response_data?.sheets || [];
          if (sheets.length > 0) {
            const tabs = sheets.map((sheet: { properties?: { sheetId?: number; title?: string } }) => ({
              id: sheet.properties?.sheetId ?? 0,
              name: sheet.properties?.title ?? "Sheet1",
            }));
            console.log("Found tabs from info:", tabs.map((t: { name: string }) => t.name));
            return Response.json({ tabs });
          }
        } catch {
          // Continue to fallback
        }
      }

      // Fallback: Use BATCH_GET and parse sheet names from the range response
      console.log("Trying fallback: BATCH_GET to detect sheet names...");
      
      // Try common sheet names
      const commonNames = ["Sheet1", "Sheet2", "Sheet3", "Data", "Main"];
      const detectedTabs: Array<{ id: number; name: string }> = [];
      
      for (let i = 0; i < commonNames.length; i++) {
        const sheetName = commonNames[i];
        const testResponse = await fetch(
          "https://backend.composio.dev/api/v2/actions/GOOGLESHEETS_BATCH_GET/execute",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": COMPOSIO_API_KEY,
            },
            body: JSON.stringify(
              connectedAccountId
                ? {
                    connectedAccountId,
                    input: {
                      spreadsheet_id: spreadsheetId,
                      ranges: [`${sheetName}!A1:A1`],
                    },
                  }
                : {
                    entityId: userId,
                    appName: "googlesheets",
                    input: {
                      spreadsheet_id: spreadsheetId,
                      ranges: [`${sheetName}!A1:A1`],
                    },
                  }
            ),
          }
        );
        
        if (testResponse.ok) {
          const testData = await testResponse.text();
          // Check if we got data back (not an error about the sheet not existing)
          if (!testData.includes("Unable to parse range") && !testData.includes("not found")) {
            detectedTabs.push({ id: i, name: sheetName });
          }
        }
        
        // Stop after finding at least one tab and checking a couple more
        if (detectedTabs.length > 0 && i >= detectedTabs.length + 1) {
          break;
        }
      }
      
      if (detectedTabs.length > 0) {
        console.log("Detected tabs via BATCH_GET:", detectedTabs.map(t => t.name));
        return Response.json({ tabs: detectedTabs });
      }

      // Ultimate fallback: just return Sheet1
      console.log("No tabs detected, returning default Sheet1");
      return Response.json({ tabs: [{ id: 0, name: "Sheet1" }] });
    } catch (error) {
      console.error("Get sheet tabs error:", error);
      return Response.json({ tabs: [{ id: 0, name: "Sheet1" }] });
    }
  },
});
