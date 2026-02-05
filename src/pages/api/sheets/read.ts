import { route } from "rwsdk/router";
import { fetchSheetValues, type AuthContext } from "../../../lib/sheets";

export default route("/api/sheets/read", {
  post: async ({ request }) => {
    let body: {
      sheetId?: string;
      mode?: "service" | "oauth";
      oauthTokens?: { accessToken: string; refreshToken?: string };
    };

    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.sheetId || !body.mode) {
      return Response.json(
        { ok: false, error: "sheetId and mode are required" },
        { status: 400 },
      );
    }

    let authContext: AuthContext;
    if (body.mode === "service") {
      authContext = { type: "service" };
    } else {
      if (!body.oauthTokens?.accessToken) {
        return Response.json(
          { ok: false, error: "OAuth tokens required" },
          { status: 401 },
        );
      }
      authContext = {
        type: "oauth",
        accessToken: body.oauthTokens.accessToken,
        refreshToken: body.oauthTokens.refreshToken,
      };
    }

    try {
      const result = await fetchSheetValues(authContext, body.sheetId);
      return Response.json({ ok: true, result });
    } catch (error) {
      console.error("fetchSheetValues failed", error);
      return Response.json(
        { ok: false, error: "Read failed" },
        { status: 500 },
      );
    }
  },
});