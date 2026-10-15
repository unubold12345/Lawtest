import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// /v2 activity beacon (logged-in users): presence heartbeat + run milestones.
// Body: { state: "hub"|"run", mode?, label?, idx?, total?, answered?, event?: "run_start"|"run_finish", score?, subs? }
// GET: per-user run_finish counts keyed by fully covered subcategory ("main\u0001sub"), for the /v2 map modal.
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
  const subs =
    event === "run_finish" && Array.isArray(body.subs)
      ? [
          ...new Set(
            (body.subs as unknown[])
              .filter((s): s is string => typeof s === "string")
              .map((s) => s.slice(0, 200).trim())
              .filter(Boolean)
          ),
        ].slice(0, 300)
      : [];

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
          subs,
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

export async function GET() {
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = (session?.user as unknown as { id?: string } | undefined)?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });

  try {
    const rows = await prisma.studyEvent.findMany({
      where: { userId, type: "run_finish" },
      select: { subs: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    const counts: Record<string, number> = {};
    for (const r of rows) for (const k of r.subs) counts[k] = (counts[k] ?? 0) + 1;
    return NextResponse.json({ counts });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
}
