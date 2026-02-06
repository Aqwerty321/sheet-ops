import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const getApiKey = () => process.env.COMPOSIO_API_KEY || "";

/**
 * List user's Google Sheets via Composio
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "anonymous";
    const connectedAccountId = searchParams.get("connectedAccountId");

    try {
        console.log("Fetching sheets for user:", userId, "connectedAccountId:", connectedAccountId);

        // Execute the GOOGLESHEETS_LIST_SPREADSHEETS action
        const response = await fetch(
            "https://backend.composio.dev/api/v2/actions/GOOGLESHEETS_LIST_SPREADSHEETS/execute",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": getApiKey(),
                },
                body: JSON.stringify(
                    connectedAccountId
                        ? { connectedAccountId, input: {} }
                        : { entityId: userId, appName: "googlesheets", input: {} }
                ),
            },
        );

        const responseText = await response.text();
        console.log("List spreadsheets response:", response.status, responseText);

        if (!response.ok) {
            console.error("Failed to list sheets:", responseText);

            // Try alternative: use Drive API to list spreadsheets
            const driveResponse = await fetch(
                "https://backend.composio.dev/api/v2/actions/GOOGLEDRIVE_LIST_FILES/execute",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": getApiKey(),
                    },
                    body: JSON.stringify(
                        connectedAccountId
                            ? {
                                connectedAccountId,
                                input: {
                                    q: "mimeType='application/vnd.google-apps.spreadsheet'",
                                    pageSize: 50,
                                },
                            }
                            : {
                                entityId: userId,
                                appName: "googledrive",
                                input: {
                                    q: "mimeType='application/vnd.google-apps.spreadsheet'",
                                    pageSize: 50,
                                },
                            }
                    ),
                },
            );

            if (!driveResponse.ok) {
                const driveErrorText = await driveResponse.text();
                console.error("Drive list files also failed:", driveErrorText);
                return NextResponse.json(
                    { error: "Failed to list spreadsheets", sheets: [], debug: { sheets: responseText, drive: driveErrorText } },
                    { status: 200 }, // Return 200 so frontend can see debug info
                );
            }

            const driveDataText = await driveResponse.text();
            console.log("Drive list files response:", driveDataText);

            let driveData: { data?: { files?: Array<{ id: string; name: string }>; response_data?: { files?: Array<{ id: string; name: string }> } } };
            try {
                driveData = JSON.parse(driveDataText);
            } catch {
                return NextResponse.json({ error: "Invalid drive response", sheets: [], debug: driveDataText });
            }

            // Handle both response formats: data.files or data.response_data.files
            const files = driveData.data?.files || driveData.data?.response_data?.files || [];
            console.log("Found files from drive:", files.length);
            return NextResponse.json({
                sheets: files.map((f) => ({ id: f.id, name: f.name })),
            });
        }

        let data: { data?: { response_data?: { files?: Array<{ id: string; name: string }> } } };
        try {
            data = JSON.parse(responseText);
        } catch {
            return NextResponse.json({ error: "Invalid response", sheets: [], debug: responseText });
        }

        const files = data.data?.response_data?.files || [];
        console.log("Found files from sheets:", files.length);
        return NextResponse.json({
            sheets: files.map((f) => ({ id: f.id, name: f.name })),
        });
    } catch (error) {
        console.error("List sheets error:", error);
        return NextResponse.json(
            { error: "Failed to list spreadsheets", sheets: [] },
            { status: 500 },
        );
    }
}

// Get sheet data (for pull/sync)
export async function POST(request: NextRequest) {
    let body: {
        userId?: string;
        sheetId?: string;
        range?: string;
        connectedAccountId?: string;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const userId = body.userId || "anonymous";
    const sheetId = body.sheetId;
    const range = body.range || "A1:Z1000";
    const connectedAccountId = body.connectedAccountId;

    if (!sheetId) {
        return NextResponse.json({ error: "sheetId required" }, { status: 400 });
    }

    // First, get the connectedAccountId if not provided
    let accountId = connectedAccountId;
    if (!accountId) {
        try {
            const accountsRes = await fetch(
                `https://backend.composio.dev/api/v1/connectedAccounts?entityId=${userId}`,
                {
                    headers: { "x-api-key": getApiKey() },
                }
            );
            if (accountsRes.ok) {
                const accountsData = (await accountsRes.json()) as {
                    items?: Array<{ id?: string; status?: string; appName?: string }>;
                };
                const activeAccount = accountsData.items?.find(
                    (item) => item.appName?.toLowerCase().includes("sheet") && item.status === "ACTIVE"
                );
                accountId = activeAccount?.id;
            }
        } catch {
            // Ignore, will try without accountId
        }
    }

    console.log("Fetching sheet data for:", sheetId, "with accountId:", accountId);

    try {
        // Get sheet values via Composio
        const response = await fetch(
            "https://backend.composio.dev/api/v2/actions/GOOGLESHEETS_BATCH_GET/execute",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": getApiKey(),
                },
                body: JSON.stringify(
                    accountId
                        ? {
                            connectedAccountId: accountId,
                            input: {
                                spreadsheet_id: sheetId,
                                ranges: [range],
                            },
                        }
                        : {
                            entityId: userId,
                            appName: "googlesheets",
                            input: {
                                spreadsheet_id: sheetId,
                                ranges: [range],
                            },
                        }
                ),
            },
        );

        const responseText = await response.text();
        console.log("Sheet data response:", response.status, responseText.slice(0, 500));

        if (!response.ok) {
            console.error("Failed to get sheet data:", responseText);
            return NextResponse.json(
                { error: "Failed to fetch sheet data", debug: responseText },
                { status: 200 }, // Return 200 so frontend can see error
            );
        }

        let data: {
            data?: {
                values?: string[][];
                valueRanges?: Array<{ values?: string[][] }>;
                response_data?: {
                    valueRanges?: Array<{ values?: string[][] }>;
                };
            };
        };
        try {
            data = JSON.parse(responseText);
        } catch {
            return NextResponse.json({ error: "Invalid response", debug: responseText });
        }

        // Handle multiple response formats:
        // 1. data.values (direct)
        // 2. data.valueRanges[0].values (batch get format)
        // 3. data.response_data.valueRanges[0].values (wrapped format)
        const values =
            data.data?.values ||
            data.data?.valueRanges?.[0]?.values ||
            data.data?.response_data?.valueRanges?.[0]?.values ||
            [];
        console.log("Fetched values:", values.length, "rows");
        return NextResponse.json({ values });
    } catch (error) {
        console.error("Get sheet data error:", error);
        return NextResponse.json(
            { error: "Failed to fetch sheet data" },
            { status: 500 },
        );
    }
}
