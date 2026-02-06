import { NextResponse } from "next/server";

export async function GET() {
    // TODO: implement real OAuth flow and secure token storage
    return NextResponse.json({ url: "/api/sheets/oauth-callback?code=demo" });
}
