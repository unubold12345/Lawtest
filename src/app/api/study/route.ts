import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Study progress for /v2 (Сорилго v2).
// GET  -> { cards: [[questionId, attempts, correct, streak, lastOk, lastSeenAtMs], ...] }
// POST { results: [{ id, ok }] } -> upsert per question (max 200 per call)
export async function GET() {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const rows = await prisma.studyCard.findMany({
    where: { userId },
    select: { questionId: true, attempts: true, correct: true, streak: true, lastOk: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
  });
  return NextResponse.json({
    cards: rows.map((r) => [r.questionId, r.attempts, r.correct, r.streak, r.lastOk ? 1 : 0, r.lastSeenAt.getTime()]),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  let body: { results?: Array<{ id?: unknown; ok?: unknown }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  const list = Array.isArray(body.results) ? body.results : [];
  const parsed = list
    .map((r) => ({ id: String(r?.id ?? "").trim(), ok: r?.ok === true }))
    .filter((r) => r.id.length > 0)
    .slice(0, 200);
  if (parsed.length === 0) return NextResponse.json({ saved: 0 });
  await prisma.$transaction(
    parsed.map((r) =>
      prisma.studyCard.upsert({
        where: { userId_questionId: { userId, questionId: r.id } },
        create: { userId, questionId: r.id, attempts: 1, correct: r.ok ? 1 : 0, streak: r.ok ? 1 : 0, lastOk: r.ok },
        update: {
          attempts: { increment: 1 },
          correct: r.ok ? { increment: 1 } : undefined,
          streak: r.ok ? { increment: 1 } : 0,
          lastOk: r.ok,
          lastSeenAt: new Date(),
        },
      })
    )
  );
  return NextResponse.json({ saved: parsed.length });
}
