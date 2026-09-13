import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Per-user activity for the calendar: exams (attempts), notes, comments, saved answers.
// GET ?from=2026-09-01&to=2026-10-31 -> { attempts, notes, comments, saved } (401 when guest)
export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const from = new Date((sp.get("from") || "2026-09-01") + "T00:00:00+08:00");
  const to = new Date((sp.get("to") || "2026-10-31") + "T23:59:59+08:00");
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Буруу огноо" }, { status: 400 });
  }
  const [attempts, notes, saved, comments] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      select: { id: true, category: true, mode: true, score: true, total: true, createdAt: true },
    }),
    prisma.questionNote.findMany({
      where: { userId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      select: { questionId: true, content: true, createdAt: true },
    }),
    prisma.savedAnswer.findMany({
      where: { userId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      select: { questionId: true, createdAt: true },
    }),
    prisma.comment.findMany({
      where: { userId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      select: { questionId: true, content: true, createdAt: true },
    }),
  ]);
  return NextResponse.json({
    attempts: attempts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    notes: notes.map((n) => ({ questionId: n.questionId, content: n.content.slice(0, 200), createdAt: n.createdAt.toISOString() })),
    comments: comments.map((c) => ({ questionId: c.questionId, content: c.content.slice(0, 200), createdAt: c.createdAt.toISOString() })),
    saved: saved.map((s) => ({ questionId: s.questionId, createdAt: s.createdAt.toISOString() })),
  });
}
