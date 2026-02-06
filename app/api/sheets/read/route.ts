import { NextRequest, NextResponse } from "next/server";
import { fetchSheetValues, type AuthContext } from "@/lib/sheets";

export async function POST(request: NextRequest) {
    let body: {
        sheetId?: string;
        mode?: "service" | "oauth";
        oauthTokens?: { accessToken: string; refreshToken?: string };
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.sheetId || !body.mode) {
        return NextResponse.json(
            { ok: false, error: "sheetId and mode are required" },
            { status: 400 },
        );
    }

    let authContext: AuthContext;
    if (body.mode === "service") {
        authContext = { type: "service" };
    } else {
        if (!body.oauthTokens?.accessToken) {
            return NextResponse.json(
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
        return NextResponse.json({ ok: true, result });
    } catch (error) {
        console.error("fetchSheetValues failed", error);
        return NextResponse.json(
            { ok: false, error: "Read failed" },
            { status: 500 },
        );
    }
}
