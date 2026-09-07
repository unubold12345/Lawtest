import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
  return NextResponse.json({
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
