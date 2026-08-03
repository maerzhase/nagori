import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";

export async function GET() {
  try {
    await getEnv().DB.prepare("SELECT 1").first();
    return NextResponse.json(
      { ok: true, service: "dashboard", version: getEnv().BUILD_SHA ?? "dev" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, service: "dashboard", error: "dependency_unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
