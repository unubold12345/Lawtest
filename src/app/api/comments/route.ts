import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const questionId = searchParams.get("questionId");
  if (!questionId) return NextResponse.json({ comments: [] });
  const rows = await prisma.comment.findMany({
    where: { questionId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
    take: 100,
  });
  const comments = rows.map((r: { id: string; questionId: string; content: string; createdAt: Date; user: { id: string; name: string | null; email: string } }) => ({
    id: r.id,
    questionId: r.questionId,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    user: r.user,
  }));
  return NextResponse.json({ comments });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
  try {
    const { questionId, content } = await req.json();
    if (!questionId || !content?.trim()) return NextResponse.json({ error: "Хоосон байна" }, { status: 400 });
    if (String(content).length > 2000) return NextResponse.json({ error: "Хэт урт (≤2000)" }, { status: 400 });
    const row = await prisma.comment.create({
      data: { questionId: String(questionId), userId, content: String(content).trim() },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({
      comment: {
        id: row.id,
        questionId: row.questionId,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
        user: row.user,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}
