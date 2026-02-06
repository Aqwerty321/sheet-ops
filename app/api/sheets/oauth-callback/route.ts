import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    // TODO: implement real OAuth flow and secure token storage
    return NextResponse.json({
        accessToken: "demo-access",
        refreshToken: "demo-refresh",
    });
}
