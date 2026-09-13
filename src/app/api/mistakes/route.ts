import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Per-user mistake tracking for «Их алддаг сорилгууд».
// GET -> { mistakes: [{ questionId, wrongCount, manual, updatedAt }] }
// POST { ids: string[] } -> wrongCount +1 each (exam auto-record)
// POST { questionId, manual: true } -> flag as manually added (creates row if new)
// DELETE ?questionId= -> remove from the section
export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const rows = await prisma.mistake.findMany({
    where: { userId },
    select: { questionId: true, wrongCount: true, manual: true, updatedAt: true },
    orderBy: [{ wrongCount: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json({
    mistakes: rows.map((r) => ({ questionId: r.questionId, wrongCount: r.wrongCount, manual: r.manual, updatedAt: r.updatedAt.toISOString() })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  let body: { ids?: string[]; questionId?: string; manual?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  // exam auto-record: bump wrongCount for each wrongly answered question
  if (Array.isArray(body.ids)) {
    const ids = [...new Set(body.ids.map((s) => String(s).trim()).filter(Boolean))].slice(0, 200);
    if (ids.length === 0) return NextResponse.json({ mistakes: [] });
    const rows = await prisma.$transaction(
      ids.map((questionId) =>
        prisma.mistake.upsert({
          where: { userId_questionId: { userId, questionId } },
          create: { userId, questionId, wrongCount: 1 },
          update: { wrongCount: { increment: 1 } },
        })
      )
    );
    return NextResponse.json({
      mistakes: rows.map((r) => ({ questionId: r.questionId, wrongCount: r.wrongCount, manual: r.manual })),
    });
  }
  // manual add from exam result
  const questionId = (body.questionId || "").trim();
  if (!questionId) return NextResponse.json({ error: "Сорилго сонгогдоогүй" }, { status: 400 });
  if (body.manual !== true) return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  const row = await prisma.mistake.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: { userId, questionId, wrongCount: 0, manual: true },
    update: { manual: true },
  });
  return NextResponse.json({ ok: true, mistake: { questionId: row.questionId, wrongCount: row.wrongCount, manual: row.manual } });
}

export async function DELETE(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const questionId = (new URL(req.url).searchParams.get("questionId") || "").trim();
  if (!questionId) return NextResponse.json({ error: "Сорилго сонгогдоогүй" }, { status: 400 });
  await prisma.mistake.deleteMany({ where: { userId, questionId } });
  return NextResponse.json({ ok: true });
}
