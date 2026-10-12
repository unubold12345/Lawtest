import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// /v2 activity beacon (logged-in users): presence heartbeat + run milestones.
// Body: { state: "hub"|"run", mode?, label?, idx?, total?, answered?, event?: "run_start"|"run_finish", score? }
const int = (v: unknown, max: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(Math.trunc(v), max)) : 0;
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max).trim() : "");

export async function POST(req: Request) {
  if (!rateLimit(`activity:${clientIp(req)}`, 240, 60 * 1000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = (session?.user as unknown as { id?: string } | undefined)?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const state = body.state === "run" ? "run" : "hub";
  const mode = body.mode === "study" || body.mode === "exam" ? (body.mode as string) : null;
  const label = str(body.label, 120) || null;
  const idx = int(body.idx, 100000);
  const total = int(body.total, 100000);
  const answered = int(body.answered, 100000);
  const event = body.event === "run_start" || body.event === "run_finish" ? (body.event as string) : null;

  try {
    await prisma.studyPresence.upsert({
      where: { userId },
      create: { userId, state, mode, label, idx, total, answered },
      update: { state, mode, label, idx, total, answered },
    });
    if (event) {
      await prisma.studyEvent.create({
        data: {
          userId,
          type: event,
          mode,
          label,
          total,
          score: event === "run_finish" ? int(body.score, 100000) : null,
        },
      });
    }
  } catch {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
