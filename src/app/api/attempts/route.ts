import { NextResponse } from "next/server";
import { requestUserId } from "@/lib/mobileAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const userId = await requestUserId(req);
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
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
  try {
    const body = await req.json();
    const { category, mode, score, total, elapsed, answers, questionIds } = body ?? {};
    if (
      typeof score !== "number" ||
      typeof total !== "number" ||
      !Number.isInteger(score) ||
      !Number.isInteger(total) ||
      total <= 0 ||
      total > 500 ||
      score < 0 ||
      score > total
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const elapsedSec = elapsed === undefined || elapsed === null ? 0 : Number(elapsed);
    if (!Number.isInteger(elapsedSec) || elapsedSec < 0 || elapsedSec > 86400) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const safeAnswers: Record<string, number> = {};
    if (answers !== undefined && answers !== null) {
      if (typeof answers !== "object" || Array.isArray(answers)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      const entries = Object.entries(answers as Record<string, unknown>);
      if (entries.length > 500) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      for (const [k, v] of entries) {
        const idx = Number(v);
        if (!k || k.length > 200 || !Number.isInteger(idx) || idx < 0 || idx > 10) {
          return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }
        safeAnswers[k] = idx;
      }
    }
    let safeIds: string[] = [];
    if (questionIds !== undefined && questionIds !== null) {
      if (!Array.isArray(questionIds) || questionIds.length > 500) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      safeIds = questionIds.map((id) => String(id).slice(0, 200));
    }
    const row = await prisma.attempt.create({
      data: {
        userId,
        category: String(category || "all").slice(0, 200),
        mode: String(mode || "exam").slice(0, 50),
        score,
        total,
        elapsed: elapsedSec,
        answers: JSON.stringify(safeAnswers),
        questionIds: JSON.stringify(safeIds),
      },
    });
    return NextResponse.json({ id: row.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  await prisma.attempt.deleteMany({ where: id ? { userId, id } : { userId } });
  return NextResponse.json({ ok: true });
}
