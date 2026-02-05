import { route } from "rwsdk/router";

export default route("/api/sheets/oauth-callback", {
  get: async ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return Response.json({ error: "Missing code" }, { status: 400 });
    }

    // TODO: implement real OAuth flow and secure token storage
    return Response.json({
      accessToken: "demo-access",
      refreshToken: "demo-refresh",
    });
  },
});