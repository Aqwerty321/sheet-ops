import { route } from "rwsdk/router";

export default route("/api/sheets/oauth-start", {
  get: async () => {
    // TODO: implement real OAuth flow and secure token storage
    return Response.json({ url: "/api/sheets/oauth-callback?code=demo" });
  },
});