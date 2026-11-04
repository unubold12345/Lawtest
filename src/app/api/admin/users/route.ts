import { getPlan, getEdition, LEGACY_EDITION_ID, LEGACY_PLAN_ID } from "@/lib/catalog";
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
    select: {
      id: true,
      phone: true,
      email: true,
      role: true,
      paidAt: true,
      createdAt: true,
      _count: { select: { attempts: true, comments: true, savedAnswers: true, notes: true, mistakes: true } },
      attempts: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, score: true, total: true, elapsed: true } },
      visits: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  const rows = users.map((u) => {
    const last = u.attempts[0] || null;
    const lastVisit = u.visits[0]?.createdAt || null;
    const lastAttempt = last?.createdAt || null;
    const lastSeen =
      lastAttempt && lastVisit
        ? lastAttempt > lastVisit
          ? lastAttempt
          : lastVisit
        : lastAttempt || lastVisit;
    return {
      id: u.id,
      phone: u.phone,
      email: u.email,
      role: u.role,
      paidAt: u.paidAt,
      createdAt: u.createdAt,
      _count: u._count,
      lastAttemptAt: lastAttempt,
      lastSeen,
      lastScore: last ? { score: last.score, total: last.total } : null,
      lastElapsed: last?.elapsed ?? null,
    };
  });
  return NextResponse.json({ users: rows });
}

export async function PATCH(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  try {
    const { id, role, paid, planId = LEGACY_PLAN_ID } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    // manual plan grant / revoke (төлбөрийг гараар баталгаажуулах)
    if (typeof paid === "boolean") {
      const plan = getPlan(planId);
      if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
      const updated = await prisma.$transaction(async (tx) => {
        const before = await tx.examEntitlement.findUnique({ where: { userId_editionId: { userId: id, editionId: plan.editionId } } });
        if (paid) {
          await tx.examEntitlement.upsert({
            where: { userId_editionId: { userId: id, editionId: plan.editionId } },
            create: { userId: id, editionId: plan.editionId, planId: plan.id }, update: {},
          });
        } else {
          await tx.examEntitlement.deleteMany({ where: { userId: id, editionId: plan.editionId } });
        }
        const user = await tx.user.update({
          where: { id },
          data: plan.editionId === LEGACY_EDITION_ID ? { paidAt: paid ? new Date() : null } : {},
          select: { id: true, paidAt: true, entitlements: { select: { editionId: true, planId: true } } },
        });
        if (paid && !before) await tx.announcement.create({ data: {
          body: `${getEdition(plan.editionId)!.title} — таны эрх амжилттай нээгдлээ.`, recipients: { connect: [{ id }] },
        } });
        return user;
      });
      return NextResponse.json({ user: updated });
    }
    if (!["USER", "ADMIN"].includes(role)) return NextResponse.json({ error: "role USER|ADMIN required" }, { status: 400 });
    if (role === "USER") {
      const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (!target) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
      if (target.role === "ADMIN") {
        const admins = await prisma.user.count({ where: { role: "ADMIN" } });
        if (admins <= 1) return NextResponse.json({ error: "Сүүлийн админыг хасах боломжгүй" }, { status: 400 });
      }
    }
    const updated = await prisma.user.update({ where: { id }, data: { role }, select: { id: true, role: true } });
    return NextResponse.json({ user: updated });
  } catch (e) {
    console.error("admin/users PATCH", e);
    return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  }
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
  try {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
    if (target.role === "ADMIN") {
      const admins = await prisma.user.count({ where: { role: "ADMIN" } });
      if (admins <= 1) return NextResponse.json({ error: "Сүүлийн админыг устгах боломжгүй" }, { status: 400 });
    }
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin/users DELETE", e);
    return NextResponse.json({ error: "Устгах боломжгүй" }, { status: 400 });
  }
}
