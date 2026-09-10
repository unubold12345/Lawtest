import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрээгүй" }, { status: 401 });
  const c = await prisma.comment.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  if (c.userId !== userId) {
    // admins can delete any comment
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (me?.role !== "ADMIN") return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }
  await prisma.comment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
