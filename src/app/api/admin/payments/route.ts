import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim() || "";
  const requests = await prisma.paymentRequest.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, name: true, phone: true, email: true, paidAt: true } } },
  });
  const pending = await prisma.paymentRequest.count({ where: { status: "PENDING" } });
  return NextResponse.json({ requests, pending });
}

export async function PATCH(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id, action } = await req.json();
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "id + action (approve|reject) required" }, { status: 400 });
  }
  const found = await prisma.paymentRequest.findUnique({ where: { id } });
  if (!found) return NextResponse.json({ error: "Хүсэлт олдсонгүй" }, { status: 404 });
  if (action === "approve") {
    await prisma.$transaction([
      prisma.paymentRequest.update({ where: { id }, data: { status: "APPROVED", decidedAt: new Date() } }),
      prisma.user.update({ where: { id: found.userId }, data: { paidAt: new Date() } }),
    ]);
  } else {
    await prisma.paymentRequest.update({ where: { id }, data: { status: "REJECTED", decidedAt: new Date() } });
  }
  return NextResponse.json({ ok: true });
}
