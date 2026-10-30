import { NextResponse } from "next/server";
import { requestUserId } from "@/lib/mobileAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ exams: [] }, { status: 401 });
  const rows = await prisma.savedExam.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  const exams = rows.map((r) => ({
    key: r.key,
    data: r.data,
    updatedAt: r.updatedAt.getTime(),
  }));
  return NextResponse.json({ exams });
}

export async function POST(req: Request) {
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
  try {
    const body = await req.json();
    const key = String(body?.key || "").trim();
    if (!key || key.length > 100) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    if (body?.data === null) {
      await prisma.savedExam.deleteMany({ where: { userId, key } });
      return NextResponse.json({ ok: true, deleted: true });
    }
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, paidAt: true } });
    if (!dbUser || (dbUser.role !== "ADMIN" && !dbUser.paidAt)) {
      return NextResponse.json({ error: "Эрх нээгдээгүй байна" }, { status: 403 });
    }
    const data = body?.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const row = await prisma.savedExam.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, data },
      update: { data },
    });
    return NextResponse.json({ ok: true, key: row.key });
  } catch (e) {
    console.error("saved-exams", e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}
