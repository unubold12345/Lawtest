import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ attempts: [] }, { status: 401 });
  const rows = await prisma.attempt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const attempts = rows.map((r) => ({
    id: r.id,
    date: r.createdAt.toISOString(),
    category: r.category,
    count: r.total,
    mode: r.mode,
    score: r.score,
    total: r.total,
    elapsed: r.elapsed,
    answers: JSON.parse(r.answers),
    questionIds: JSON.parse(r.questionIds),
  }));
  return NextResponse.json({ attempts });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
  try {
    const body = await req.json();
    const { category, mode, score, total, elapsed, answers, questionIds } = body;
    if (typeof score !== "number" || typeof total !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const row = await prisma.attempt.create({
      data: {
        userId,
        category: String(category || "all"),
        mode: String(mode || "exam"),
        score: Number(score),
        total: Number(total),
        elapsed: Number(elapsed || 0),
        answers: JSON.stringify(answers || {}),
        questionIds: JSON.stringify(questionIds || []),
      },
    });
    return NextResponse.json({ id: row.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
  await prisma.attempt.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
