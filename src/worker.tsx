import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import LandingPage from "@/app/page";
import SheetPage from "@/app/sheet/[sheetId]/page";
import sheetsExecute from "@/pages/api/sheets/execute";
import sheetsOauthStart from "@/pages/api/sheets/oauth-start";
import sheetsOauthCallback from "@/pages/api/sheets/oauth-callback";
import sheetsRead from "@/pages/api/sheets/read";
import chatProxy from "@/pages/api/chat/proxy";
import composioConnection from "@/pages/api/composio/connection";
import composioSheets from "@/pages/api/composio/sheets";
import composioSheetTabs from "@/pages/api/composio/sheet-tabs";
import composioPush from "@/pages/api/composio/push";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", () => <LandingPage />),
    route("/sheet/:sheetId", ({ params }) => (
      <SheetPage params={{ sheetId: params.sheetId }} />
    )),
    sheetsExecute,
    sheetsOauthStart,
    sheetsOauthCallback,
    sheetsRead,
    chatProxy,
    composioConnection,
    composioSheets,
    composioSheetTabs,
    composioPush,
  ]),
]);
