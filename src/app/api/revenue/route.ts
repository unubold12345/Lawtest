import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { getFinanceSummary } from "@/lib/finance";

export const dynamic = "force-dynamic";

// Read-only revenue API for the Project Revenue desktop client.
// REVENUE_API_KEY may be a comma-separated list to allow key rotation.
function configuredKeys(): string[] {
  return (process.env.REVENUE_API_KEY || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

function requestKey(req: Request): string {
  const bearer = /^Bearer\s+(.+)$/i.exec((req.headers.get("authorization") || "").trim())?.[1];
  return (req.headers.get("x-api-key") || bearer || "").trim();
}

export async function GET(req: Request) {
  const keys = configuredKeys();
  if (keys.length === 0) {
    return NextResponse.json(
      { error: "REVENUE_API_KEY is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const provided = requestKey(req);
  if (!provided || !keys.some((key) => safeEqual(provided, key))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const summary = await getFinanceSummary();
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
