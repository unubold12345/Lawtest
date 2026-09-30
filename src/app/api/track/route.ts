import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// Anonymous page-view beacon. No IP/PII stored — only path + random session id.
// Body: { path: "/browse", sessionId: "<random 8-64 chars>" }
export async function POST(req: Request) {
  if (!rateLimit(`track:${clientIp(req)}`, 120, 60 * 1000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  let body: { path?: unknown; sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const rawPath = typeof body.path === "string" ? body.path : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  // keep it tight: must look like "/..." and stay short; strip query/hash
  const path = rawPath.split(/[?#]/)[0].slice(0, 200);
  if (!/^\/[A-Za-z0-9\-_./%]*$/.test(path)) {
    return NextResponse.json({ error: "bad path" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9\-_]{8,64}$/.test(sessionId)) {
    return NextResponse.json({ error: "bad session" }, { status: 400 });
  }
  // skip noise: admin panel + api calls shouldn't inflate guest stats
  if (path.startsWith("/admin") || path.startsWith("/api/")) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = (session?.user as unknown as { id?: string } | undefined)?.id ?? null;
  } catch {
    userId = null;
  }
  try {
    await prisma.pageView.create({ data: { path, sessionId, userId } });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
