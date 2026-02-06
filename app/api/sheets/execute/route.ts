import { NextRequest, NextResponse } from "next/server";
import { executeOperations, type AuthContext, type EditOperation } from "@/lib/sheets";

export async function POST(request: NextRequest) {
    let body: {
        sheetId?: string;
        ops?: EditOperation[];
        mode?: "service" | "oauth";
        oauthTokens?: { accessToken: string; refreshToken?: string };
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.sheetId || !body.ops || !Array.isArray(body.ops) || !body.mode) {
        return NextResponse.json(
            { ok: false, error: "sheetId, ops, and mode are required" },
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
        const result = await executeOperations(authContext, body.sheetId, body.ops);
        return NextResponse.json({ ok: true, result });
    } catch (error) {
        console.error("executeOperations failed", error);
        return NextResponse.json(
            { ok: false, error: "Execution failed" },
            { status: 500 },
        );
    }
}
