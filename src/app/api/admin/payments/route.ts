import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { getEdition, LEGACY_EDITION_ID } from "@/lib/catalog";

export async function GET(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const status = new URL(req.url).searchParams.get("status")?.trim() || "";
  const requests = await prisma.paymentRequest.findMany({
    where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 100,
    include: { user: { select: { id: true, name: true, phone: true, email: true, paidAt: true } } },
  });
  const pending = await prisma.paymentRequest.count({ where: { status: "PENDING" } });
  return NextResponse.json({ requests, pending });
}

export async function PATCH(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { id, action } = body;
  if (typeof id !== "string" || !["approve", "reject"].includes(action)) return NextResponse.json({ error: "id + action required" }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    const found = await tx.paymentRequest.findUnique({ where: { id } });
    if (!found) return { status: 404, error: "Хүсэлт олдсонгүй" };
    // A decision is final; retries never grant/revoke access a second time.
    const decided = await tx.paymentRequest.updateMany({
      where: { id, status: "PENDING" },
      data: { status: action === "approve" ? "APPROVED" : "REJECTED", decidedAt: new Date(), pendingKey: null },
    });
    if (!decided.count) return { status: 409, error: "Хүсэлтийг өмнө нь шийдвэрлэсэн байна" };
    if (action === "approve") {
      // Use the immutable edition/plan recorded on the request.
      await tx.examEntitlement.upsert({
        where: { userId_editionId: { userId: found.userId, editionId: found.editionId } },
        create: { userId: found.userId, editionId: found.editionId, planId: found.planId }, update: {},
      });
      if (found.editionId === LEGACY_EDITION_ID) {
        await tx.user.update({ where: { id: found.userId }, data: { paidAt: new Date() } });
      }
      await tx.announcement.create({ data: {
        body: `${getEdition(found.editionId)?.title || found.editionId} — таны эрх амжилттай нээгдлээ.`,
        recipients: { connect: [{ id: found.userId }] },
      } });
    }
    return null;
  });
  if (result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
