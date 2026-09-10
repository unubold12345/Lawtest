import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  if (body.status !== "OPEN" && body.status !== "RESOLVED") {
    return NextResponse.json({ error: "Төлөв буруу" }, { status: 400 });
  }
  const r = await prisma.report.update({ where: { id }, data: { status: body.status } }).catch(() => null);
  if (!r) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;
  await prisma.report.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
