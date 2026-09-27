import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const rows = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, body: true, createdAt: true, _count: { select: { reads: true } } },
  });
  return NextResponse.json({
    announcements: rows.map((a) => ({ id: a.id, body: a.body, createdAt: a.createdAt, readCount: a._count.reads })),
  });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  const text = (body.body || "").trim();
  if (text.length < 3) return NextResponse.json({ error: "Мэдэгдэл хэт богино (дор хаяж 3 тэмдэгт)" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "Мэдэгдэл хэт урт (≤1000)" }, { status: 400 });
  const createdById = (guard.session.user as unknown as { id?: string })?.id || null;
  const a = await prisma.announcement.create({ data: { body: text.slice(0, 1000), createdById } });
  return NextResponse.json({ ok: true, announcement: { id: a.id, body: a.body, createdAt: a.createdAt, readCount: 0 } });
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 });
  const del = await prisma.announcement.deleteMany({ where: { id } });
  if (del.count === 0) return NextResponse.json({ error: "Мэдэгдэл олдсонгүй" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
