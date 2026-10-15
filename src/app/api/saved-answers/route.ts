import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadQuestions } from "@/lib/questions";

async function tally(ids: string[], userId?: string) {
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
  return { counts, my };
}

async function currentUserId(): Promise<string | undefined> {
  try {
    const session = await auth();
    return (session?.user as unknown as { id?: string })?.id;
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("mine") === "1") {
      const userId = await currentUserId();
      if (!userId) return NextResponse.json({ my: {} });
      const rows = await prisma.savedAnswer.findMany({ where: { userId }, select: { questionId: true, answer: true } });
      const my: Record<string, number> = {};
      for (const r of rows) my[r.questionId] = r.answer;
      return NextResponse.json({ my });
    }
    const idsParam = searchParams.get("ids") || searchParams.get("questionId") || "";
    const ids = idsParam.split("|").map((s) => s.trim()).filter(Boolean).slice(0, 2000);
    if (ids.length === 0) return NextResponse.json({ counts: {}, my: {} });

    // if authed but no row, also try to ensure my empty handled; counts still valid
    return NextResponse.json(await tally(ids, await currentUserId()));
  } catch (e: unknown) {
    console.error("saved-answers GET", e);
    return NextResponse.json({ error: "Серверийн алдаа", counts: {}, my: {} }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // votes lookup: { ids: string[] } — public, same shape as GET (avoids long URLs)
    if (Array.isArray(body?.ids)) {
      const rawIds = body.ids as unknown[];
      const list: string[] = [...new Set(rawIds.map((v) => String(v)))].filter(Boolean).slice(0, 2000);
      if (list.length === 0) return NextResponse.json({ counts: {}, my: {} });
      return NextResponse.json(await tally(list, await currentUserId()));
    }
    const session = await auth();
    const userId = (session?.user as unknown as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: "Нэвтрээгүй" }, { status: 401 });
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, paidAt: true } });
    if (!dbUser || (dbUser.role !== "ADMIN" && !dbUser.paidAt)) {
      return NextResponse.json({ error: "Эрх нээгдээгүй байна" }, { status: 403 });
    }
    const { questionId, answer } = body;
    const qId = String(questionId || "").trim();
    if (!qId) return NextResponse.json({ error: "questionId required" }, { status: 400 });
    if (answer === null || answer === undefined || answer === "") {
      await prisma.savedAnswer.deleteMany({ where: { questionId: qId, userId } });
      return NextResponse.json({ ok: true, cleared: true });
    }
    const q = loadQuestions().questions.find((x) => x.id === qId);
    if (!q || !Array.isArray(q.options) || q.options.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    const idx = Number(answer);
    if (!Number.isInteger(idx) || idx < 0 || idx >= q.options.length) {
      return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
    }
    await prisma.savedAnswer.upsert({
      where: { userId_questionId: { userId, questionId: qId } },
      update: { answer: idx },
      create: { userId, questionId: qId, answer: idx },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}
