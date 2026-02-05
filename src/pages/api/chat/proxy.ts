import { route } from "rwsdk/router";

const TOOLHOUSE_AGENT_URL =
  "https://agents.toolhouse.ai/c4633142-6a9a-4f8a-817a-9c61c003e248";

/**
 * Chat Proxy - Streams responses from Toolhouse Hosted Agent
 *
 * POST: Start new conversation
 * PUT:  Continue existing conversation (with runId)
 *
 * Injects user_id into payload for per-user Composio auth
 */
export default route("/api/chat/proxy", {
  post: async ({ request }) => {
    return handleChatRequest(request, "POST");
  },
  put: async ({ request }) => {
    return handleChatRequest(request, "PUT");
  },
});

async function handleChatRequest(
  request: Request,
  method: "POST" | "PUT",
): Promise<Response> {
  let body: {
    message?: string;
    runId?: string;
    userId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  // Use provided userId or fallback to anonymous
  const userId = body.userId || "anonymous";

  // Build Toolhouse request URL
  const url = body.runId
    ? `${TOOLHOUSE_AGENT_URL}/${body.runId}`
    : TOOLHOUSE_AGENT_URL;

  // Determine HTTP method based on runId presence
  const httpMethod = body.runId ? "PUT" : "POST";

  // Build payload with user_id for Composio per-user auth
  const payload = {
    message: body.message,
    user_id: userId,
  };

  const toolhouseApiKey = (globalThis as any).process?.env?.TOOLHOUSE_API_KEY;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };

  if (toolhouseApiKey) {
    headers["Authorization"] = `Bearer ${toolhouseApiKey}`;
  }

  try {
    const response = await fetch(url, {
      method: httpMethod,
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Toolhouse request failed:", response.status, errorText);
      return Response.json(
        { error: "Agent request failed", details: errorText },
        { status: response.status },
      );
    }

    // Extract run ID from response headers
    const runId = response.headers.get("X-Toolhouse-Run-ID") || "";

    // Stream the response body through to the client
    const responseHeaders = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Toolhouse-Run-ID": runId,
    });

    // Pass through the streaming body
    return new Response(response.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Chat proxy error:", error);
    return Response.json(
      { error: "Failed to connect to agent" },
      { status: 500 },
    );
  }
}
