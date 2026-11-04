import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requestUserId } from "@/lib/mobileAuth";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/notify";
import { getPlan, getEdition, LEGACY_PLAN_ID } from "@/lib/catalog";
import { hasEditionAccess } from "@/lib/access";
import { userAccessScope } from "@/lib/entitlements";

export async function GET(req: Request) {
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const plan = getPlan(new URL(req.url).searchParams.get("planId") || LEGACY_PLAN_ID);
  if (!plan) return NextResponse.json({ error: "Төлөвлөгөө олдсонгүй" }, { status: 404 });
  const hasPaid = hasEditionAccess(plan.editionId, await userAccessScope(userId));
  const request = await prisma.paymentRequest.findFirst({
    where: { userId, editionId: plan.editionId }, orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true, planId: true, editionId: true, amount: true },
  });
  return NextResponse.json({ hasPaid, request, planId: plan.id, editionId: plan.editionId });
}

export async function POST(req: Request) {
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  let planId = LEGACY_PLAN_ID;
  const raw = await req.text();
  if (raw.trim()) {
    try {
      const body = JSON.parse(raw);
      if (typeof body?.planId !== "string") throw new Error();
      planId = body.planId;
    } catch { return NextResponse.json({ error: "Invalid payment request" }, { status: 400 }); }
  }
  const plan = getPlan(planId);
  if (!plan) return NextResponse.json({ error: "Төлөвлөгөө олдсонгүй" }, { status: 404 });
  if (hasEditionAccess(plan.editionId, await userAccessScope(userId))) return NextResponse.json({ paid: true });
  const existing = await prisma.paymentRequest.findFirst({
    where: { userId, editionId: plan.editionId, status: "PENDING" }, orderBy: { createdAt: "desc" },
  });
  if (existing) return NextResponse.json({ request: existing });
  let request;
  try {
    request = await prisma.paymentRequest.create({ data: {
      userId, planId: plan.id, editionId: plan.editionId, amount: plan.price,
      pendingKey: `${userId}:${plan.editionId}`,
    } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    request = await prisma.paymentRequest.findUnique({ where: { pendingKey: `${userId}:${plan.editionId}` } });
    return NextResponse.json({ request });
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, email: true } });
  await notifyAdmin(`💰 ${getEdition(plan.editionId)!.title} · ${plan.price}₮ · ${user?.phone || user?.email || userId}`);
  return NextResponse.json({ request });
}
