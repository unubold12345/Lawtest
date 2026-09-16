import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = process.env.DATABASE_URL || "";
  let db = "missing";
  try {
    const users = await prisma.user.count();
    const saved = await prisma.savedAnswer.count();
    const comments = await prisma.comment.count();
    db = `ok users=${users} saved=${saved} comments=${comments}`;
  } catch (e: unknown) {
    db = `error: ${e instanceof Error ? e.message.slice(0,300) : String(e).slice(0,300)}`;
  }
  // Probe: does firebase-admin load in this runtime? (register-phone 500s empty)
  let fb = "not-tried";
  try {
    const m = await import("@/lib/firebaseAdmin");
    const r = await m.verifyFirebaseToken("dummy-token");
    fb = `loaded, dummy-token -> ${r}`;
  } catch (e: unknown) {
    fb = `LOAD-FAIL: ${e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 500) : String(e).slice(0, 500)}`;
  }
  return NextResponse.json({
    fb,
    hasDbUrl: !!url,
    host: url ? url.split("@")[1]?.split("?")[0] || "?" : null,
    isNeon: url.includes("neon.tech"),
    isPooled: url.includes("pooler"),
    authSecret: !!process.env.AUTH_SECRET,
    authUrl: process.env.AUTH_URL || null,
    db,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
  });
}
