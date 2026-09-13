import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Private per-user note on a question (one note per user+question).
// GET ?ids=a,b -> { notes: { [questionId]: { content, updatedAt } } }
// GET (no ids) -> { ids: string[] } (for the Тэмдэглэлтэй filter)
// POST { questionId, content } -> upsert; empty content deletes the note.
export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const ids = new URL(req.url).searchParams.get("ids");
  if (!ids) {
    const rows = await prisma.questionNote.findMany({ where: { userId }, select: { questionId: true } });
    return NextResponse.json({ ids: rows.map((r) => r.questionId) });
  }
  const list = ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
  const rows = await prisma.questionNote.findMany({ where: { userId, questionId: { in: list } } });
  const notes: Record<string, { content: string; updatedAt: string }> = {};
  rows.forEach((r) => { notes[r.questionId] = { content: r.content, updatedAt: r.updatedAt.toISOString() }; });
  return NextResponse.json({ notes });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  let body: { questionId?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  const questionId = (body.questionId || "").trim();
  const content = (body.content || "").trim();
  if (!questionId) return NextResponse.json({ error: "Сорилго сонгогдоогүй" }, { status: 400 });
  if (!content) {
    await prisma.questionNote.deleteMany({ where: { userId, questionId } });
    return NextResponse.json({ ok: true, deleted: true });
  }
  if (content.length > 2000) return NextResponse.json({ error: "Тэмдэглэл хэт урт (≤2000)" }, { status: 400 });
  const n = await prisma.questionNote.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: { userId, questionId, content: content.slice(0, 2000) },
    update: { content: content.slice(0, 2000) },
  });
  return NextResponse.json({ ok: true, id: n.id });
}
