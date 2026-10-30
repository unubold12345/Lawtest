import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { COST_CATEGORIES, getFinanceSummary, type CostCategory } from "@/lib/finance";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

function amount(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 1_000_000_000) return null;
  return number;
}

function category(value: unknown): CostCategory | null {
  if (typeof value !== "string") return null;
  return COST_CATEGORIES.includes(value as CostCategory) ? (value as CostCategory) : null;
}

function serialize(cost: {
  id: string;
  label: string;
  category: string;
  amount: number;
  month: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: cost.id,
    label: cost.label,
    category: cost.category,
    amount: cost.amount,
    month: cost.month,
    note: cost.note,
    createdAt: cost.createdAt.toISOString(),
    updatedAt: cost.updatedAt.toISOString(),
  };
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const [summary, costs] = await Promise.all([
    getFinanceSummary(),
    prisma.adminCost.findMany({
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
  ]);
  return NextResponse.json({ ...summary, costs: costs.map(serialize) });
}

export async function POST(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }

  const label = text(body.label, 120);
  const month = text(body.month, 7);
  const costAmount = amount(body.amount);
  const costCategory = body.category === undefined ? "custom" : category(body.category);
  const note = text(body.note, 300);
  if (!label || !month || !MONTH_RE.test(month) || costAmount === null || !costCategory) {
    return NextResponse.json({ error: "label, amount, month, category шаардлагатай" }, { status: 400 });
  }

  const userId = (check.session.user as unknown as { id?: string })?.id ?? null;
  const cost = await prisma.adminCost.create({
    data: { label, amount: costAmount, month, category: costCategory, note, createdById: userId },
  });
  return NextResponse.json({ ok: true, cost: serialize(cost) }, { status: 201 });
}

export async function PATCH(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }

  const id = text(body.id, 64);
  if (!id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 });

  const data: {
    label?: string;
    category?: CostCategory;
    amount?: number;
    month?: string;
    note?: string | null;
  } = {};

  if (body.label !== undefined) {
    const label = text(body.label, 120);
    if (!label) return NextResponse.json({ error: "label буруу" }, { status: 400 });
    data.label = label;
  }
  if (body.category !== undefined) {
    const costCategory = category(body.category);
    if (!costCategory) return NextResponse.json({ error: "category буруу" }, { status: 400 });
    data.category = costCategory;
  }
  if (body.amount !== undefined) {
    const costAmount = amount(body.amount);
    if (costAmount === null) return NextResponse.json({ error: "amount буруу" }, { status: 400 });
    data.amount = costAmount;
  }
  if (body.month !== undefined) {
    const month = text(body.month, 7);
    if (!month || !MONTH_RE.test(month)) return NextResponse.json({ error: "month буруу" }, { status: 400 });
    data.month = month;
  }
  if (body.note !== undefined) {
    data.note = typeof body.note === "string" ? body.note.trim().slice(0, 300) || null : null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Өөрчлөх талбар байхгүй" }, { status: 400 });
  }

  const existing = await prisma.adminCost.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Зардал олдсонгүй" }, { status: 404 });
  const cost = await prisma.adminCost.update({ where: { id }, data });
  return NextResponse.json({ ok: true, cost: serialize(cost) });
}

export async function DELETE(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const id = (new URL(req.url).searchParams.get("id") || "").trim().slice(0, 64);
  if (!id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 });
  const deleted = await prisma.adminCost.deleteMany({ where: { id } });
  if (deleted.count === 0) return NextResponse.json({ error: "Зардал олдсонгүй" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
