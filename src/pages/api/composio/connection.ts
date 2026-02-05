import { route } from "rwsdk/router";

const getApiKey = () => process.env.COMPOSIO_API_KEY || "";

/**
 * Composio Connection Service
 *
 * Creates connection links for Google Sheets integration
 * Returns a redirect URL for OAuth flow
 */
export default route("/api/composio/connection", {
  post: async ({ request }) => {
    let body: {
      userId?: string;
      app?: string;
      redirectUrl?: string;
    };

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const userId = body.userId || "anonymous";
    const redirectUrl = body.redirectUrl || "";

    try {
      // Step 1: Get the integration ID for Google Sheets
      const integrationsResponse = await fetch(
        "https://backend.composio.dev/api/v1/integrations?appName=googlesheets",
        {
          headers: {
            "x-api-key": getApiKey(),
          },
        },
      );

      if (!integrationsResponse.ok) {
        const errorText = await integrationsResponse.text();
        console.error("Failed to get integrations:", errorText);
        return Response.json(
          { error: "Failed to get integrations", details: errorText },
          { status: integrationsResponse.status },
        );
      }

      const integrationsData = (await integrationsResponse.json()) as {
        items?: Array<{ id: string; name: string }>;
      };

      const integration = integrationsData.items?.[0];
      if (!integration) {
        return Response.json(
          { error: "Google Sheets integration not found. Set it up in Composio dashboard first." },
          { status: 404 },
        );
      }

      console.log("Found integration:", integration.id, integration.name);

      // Step 2: Initiate connection using the correct endpoint
      const connectionResponse = await fetch(
        "https://backend.composio.dev/api/v1/connectedAccounts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": getApiKey(),
          },
          body: JSON.stringify({
            integrationId: integration.id,
            entityId: userId,
            redirectUri: redirectUrl,
            data: {}, // Required field
          }),
        },
      );

      const responseText = await connectionResponse.text();
      console.log("Composio connection response:", connectionResponse.status, responseText);

      if (!connectionResponse.ok) {
        return Response.json(
          { error: "Failed to create connection", details: responseText },
          { status: connectionResponse.status },
        );
      }

      let data: { redirectUrl?: string; connectionId?: string; id?: string };
      try {
        data = JSON.parse(responseText);
      } catch {
        return Response.json(
          { error: "Invalid response from Composio", details: responseText },
          { status: 500 },
        );
      }

      // The redirect URL might be in different fields
      const authUrl = data.redirectUrl;

      if (!authUrl) {
        console.error("No redirect URL in response:", data);
        return Response.json(
          { error: "No redirect URL returned. Check Composio integration setup.", details: data },
          { status: 500 },
        );
      }

      return Response.json({
        ok: true,
        redirectUrl: authUrl,
        connectionId: data.connectionId || data.id,
      });
    } catch (error) {
      console.error("Composio connection error:", error);
      return Response.json(
        { error: "Failed to initiate connection", details: String(error) },
        { status: 500 },
      );
    }
  },

  // Check connection status
  get: async ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || "anonymous";

    try {
      const response = await fetch(
        `https://backend.composio.dev/api/v1/connectedAccounts?entityId=${userId}`,
        {
          headers: {
            "x-api-key": getApiKey(),
          },
        },
      );

      if (!response.ok) {
        return Response.json(
          { connected: false, error: "Failed to check connection" },
          { status: response.status },
        );
      }

      const data = (await response.json()) as {
        items?: Array<{ id?: string; status?: string; appName?: string; appUniqueId?: string }>;
      };

      console.log("Connected accounts for", userId, ":", JSON.stringify(data.items, null, 2));

      // Check for Google Sheets specifically - handle various naming conventions
      const sheetsConnection = data.items?.find(
        (item) => {
          const appName = (item.appName || item.appUniqueId || "").toLowerCase();
          const isSheets = appName.includes("sheet") || appName.includes("google");
          const isActive = item.status === "ACTIVE";
          console.log(`  Account: ${appName}, status: ${item.status}, isSheets: ${isSheets}, isActive: ${isActive}`);
          return isSheets && isActive;
        }
      );

      console.log("Sheets connection found:", !!sheetsConnection, "id:", sheetsConnection?.id);

      return Response.json({
        connected: !!sheetsConnection,
        connectedAccountId: sheetsConnection?.id,
        accounts: data.items || [],
      });
    } catch (error) {
      console.error("Connection status check error:", error);
      return Response.json(
        { connected: false, error: "Failed to check connection" },
        { status: 500 },
      );
    }
  },
});
