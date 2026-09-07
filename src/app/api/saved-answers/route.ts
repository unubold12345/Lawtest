import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids") || searchParams.get("questionId") || "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ counts: {}, my: {} });

  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;

  const rows = await prisma.savedAnswer.findMany({ where: { questionId: { in: ids } }, select: { questionId: true, answer: true, userId: true } });

  const counts: Record<string, number[]> = {};
  const my: Record<string, number> = {};
  for (const id of ids) counts[id] = [0, 0, 0, 0, 0, 0]; // up to 6 but use first N

  for (const r of rows) {
    if (counts[r.questionId]) {
      if (r.answer >= 0 && r.answer < 6) counts[r.questionId][r.answer] = (counts[r.questionId][r.answer] || 0) + 1;
    }
    if (userId && r.userId === userId) my[r.questionId] = r.answer;
  }

  // if authed but no row, also try to ensure my empty handled; counts still valid
  return NextResponse.json({ counts, my });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрээгүй" }, { status: 401 });
  try {
    const { questionId, answer } = await req.json();
    if (!questionId) return NextResponse.json({ error: "questionId required" }, { status: 400 });
    if (answer === null || answer === undefined || answer === "") {
      await prisma.savedAnswer.deleteMany({ where: { questionId: String(questionId), userId } });
      return NextResponse.json({ ok: true, cleared: true });
    }
    const idx = Number(answer);
    if (!Number.isInteger(idx) || idx < 0 || idx > 10) return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
    await prisma.savedAnswer.upsert({
      where: { userId_questionId: { userId, questionId: String(questionId) } },
      update: { answer: idx },
      create: { userId, questionId: String(questionId), answer: idx },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}
