import { NextResponse } from "next/server";
import { requestUserId } from "@/lib/mobileAuth";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/notify";

async function me(req: Request) {
  const userId = await requestUserId(req);
  if (!userId) return null;
  const db = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, paidAt: true, phone: true, email: true } });
  return db;
}

// Own paid status + latest payment request (for /plan page state).
export async function GET(req: Request) {
  const db = await me(req);
  if (!db) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const hasPaid = db.role === "ADMIN" || !!db.paidAt;
  const request = await prisma.paymentRequest.findFirst({
    where: { userId: db.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true },
  });
  return NextResponse.json({ hasPaid, request });
}

// "Төлбөр төлсөн" — user asks admin to open access after paying via QR.
export async function POST(req: Request) {
  const db = await me(req);
  if (!db) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  if (db.role === "ADMIN" || db.paidAt) return NextResponse.json({ paid: true });
  const existing = await prisma.paymentRequest.findFirst({
    where: { userId: db.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true },
  });
  if (existing) return NextResponse.json({ request: existing });
  const request = await prisma.paymentRequest.create({
    data: { userId: db.id },
    select: { id: true, status: true, createdAt: true },
  });
  await notifyAdmin(`💰 Шинэ төлбөрийн хүсэлт: ${db.phone || db.email || db.id}`);
  return NextResponse.json({ request });
}
