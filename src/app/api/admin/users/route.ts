import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const take = Math.min(parseInt(url.searchParams.get("take") || "50", 10) || 50, 100);
  const where = q
    ? { OR: [{ phone: { contains: q } }, { email: { contains: q, mode: "insensitive" as const } }] }
    : {};
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, phone: true, email: true, role: true, createdAt: true, _count: { select: { attempts: true, comments: true } } },
  });
  return NextResponse.json({ users });
}

export async function PATCH(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id, role } = await req.json();
  if (!id || !["USER", "ADMIN"].includes(role)) return NextResponse.json({ error: "role USER|ADMIN required" }, { status: 400 });
  const updated = await prisma.user.update({ where: { id }, data: { role }, select: { id: true, role: true } });
  return NextResponse.json({ user: updated });
}

export async function DELETE(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // prevent self-delete
  const session = check.session;
  const selfId = (session.user as unknown as { id: string }).id;
  if (id === selfId) return NextResponse.json({ error: "Өөрийгөө устгах боломжгүй" }, { status: 400 });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
