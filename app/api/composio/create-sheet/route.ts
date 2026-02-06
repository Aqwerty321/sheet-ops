import { NextRequest, NextResponse } from "next/server";

const getApiKey = () => process.env.COMPOSIO_API_KEY || "";

/**
 * Create a new Google Spreadsheet via Composio
 * 
 * POST /api/composio/create-sheet
 * Body: { title: string, connectedAccountId?: string, userId?: string }
 */
export async function POST(request: NextRequest) {
    let body: {
        title?: string;
        connectedAccountId?: string;
        userId?: string;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const title = body.title?.trim() || "Untitled Spreadsheet";
    const connectedAccountId = body.connectedAccountId;
    const userId = body.userId || "anonymous";

    console.log("create-sheet request:", { title, connectedAccountId, userId });

    try {
        // If no connectedAccountId provided, try to get one for this user
        let accountId = connectedAccountId;

        if (!accountId) {
            const accountsResponse = await fetch(
                `https://backend.composio.dev/api/v1/connectedAccounts?entityId=${userId}`,
                {
                    headers: {
                        "x-api-key": getApiKey(),
                    },
                }
            );

            if (accountsResponse.ok) {
                const accountsData = await accountsResponse.json() as {
                    items?: Array<{ id?: string; status?: string; appName?: string; appUniqueId?: string }>;
                };

                const sheetsAccount = accountsData.items?.find(
                    (item) => {
                        const appName = (item.appName || item.appUniqueId || "").toLowerCase();
                        const isSheets = appName.includes("sheet") || appName.includes("google");
                        // We also check status to ensure we pick an active connection
                        const isActive = item.status === "ACTIVE";
                        return isSheets && isActive;
                    }
                );

                if (sheetsAccount?.id) {
                    accountId = sheetsAccount.id;
                }
            } else {
                const errorText = await accountsResponse.text();
                console.error("Failed to fetch connected accounts:", accountsResponse.status, errorText);
            }
        }

        if (!accountId) {
            return NextResponse.json(
                { error: "No connected Google account found. Please connect first." },
                { status: 400 }
            );
        }

        console.log("Creating spreadsheet with title:", title, "accountId:", accountId);

        // Use Composio to create a new spreadsheet
        const createResponse = await fetch(
            "https://backend.composio.dev/api/v2/actions/GOOGLESHEETS_CREATE_GOOGLE_SHEET/execute",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": getApiKey(),
                },
                body: JSON.stringify({
                    connectedAccountId: accountId,
                    input: {
                        title: title,
                    },
                }),
            }
        );

        const responseText = await createResponse.text();
        console.log("Create spreadsheet response:", createResponse.status, responseText);

        if (!createResponse.ok) {
            // Try alternative action name
            const altResponse = await fetch(
                "https://backend.composio.dev/api/v2/actions/GOOGLESHEETS_CREATE_SPREADSHEET/execute",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": getApiKey(),
                    },
                    body: JSON.stringify({
                        connectedAccountId: accountId,
                        input: {
                            title: title,
                        },
                    }),
                }
            );

            const altResponseText = await altResponse.text();
            console.log("Alt create response:", altResponse.status, altResponseText);

            if (!altResponse.ok) {
                return NextResponse.json(
                    { error: "Failed to create spreadsheet", details: altResponseText },
                    { status: altResponse.status }
                );
            }

            try {
                const altData = JSON.parse(altResponseText);
                const spreadsheetId = altData.data?.spreadsheetId ||
                    altData.data?.response_data?.spreadsheetId ||
                    altData.spreadsheetId;

                return NextResponse.json({
                    ok: true,
                    spreadsheetId,
                    title,
                    url: spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null,
                });
            } catch {
                return NextResponse.json(
                    { error: "Invalid response from Composio", details: altResponseText },
                    { status: 500 }
                );
            }
        }

        let data: any;
        try {
            data = JSON.parse(responseText);
        } catch {
            return NextResponse.json(
                { error: "Invalid response from Composio", details: responseText },
                { status: 500 }
            );
        }

        // Extract spreadsheet ID from response
        const spreadsheetId = data.data?.spreadsheetId ||
            data.data?.response_data?.spreadsheetId ||
            data.spreadsheetId;

        if (!spreadsheetId) {
            console.log("Full response data:", JSON.stringify(data, null, 2));
            return NextResponse.json({
                ok: true,
                message: "Spreadsheet created but ID not returned",
                data: data,
            });
        }

        return NextResponse.json({
            ok: true,
            spreadsheetId,
            title,
            url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        });

    } catch (error) {
        console.error("Create spreadsheet error:", error);
        return NextResponse.json(
            { error: "Failed to create spreadsheet", details: String(error) },
            { status: 500 }
        );
    }
}
