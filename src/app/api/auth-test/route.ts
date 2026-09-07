import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // test prisma + env without calling auth() (which needs request)
    const count = await prisma.user.count();
    const secret = process.env.AUTH_SECRET || "";
    const url = process.env.AUTH_URL || "";
    const authTrust = process.env.AUTH_TRUST_HOST || "";
    // try dynamic import auth to catch config error
    let authError: string | null = null;
    try {
      const { auth } = await import("@/lib/auth");
      await auth();
    } catch (e: unknown) { authError = e instanceof Error ? e.message + "\n" + e.stack?.slice(0,800) : String(e).slice(0,800); }
    return NextResponse.json({ count, secretLen: secret.length, url, authTrust, authError });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
