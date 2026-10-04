import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Admin-only "Зассан" marks per data file (see CategoryFix in schema.prisma).
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const fixes = await prisma.categoryFix.findMany({
    select: { category: true, subCategory: true },
    orderBy: { category: "asc" },
  });
  return NextResponse.json({ fixes });
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: { category?: unknown; subCategory?: unknown; fixed?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }

  const category = typeof body.category === "string" ? body.category.trim() : "";
  const subCategory = typeof body.subCategory === "string" ? body.subCategory.trim() : "";
  const fixed = body.fixed === true;
  if (!category) return NextResponse.json({ error: "Ангилал дутуу" }, { status: 400 });

  try {
    if (fixed) {
      await prisma.categoryFix.upsert({
        where: { category_subCategory: { category, subCategory } },
        create: { category, subCategory },
        update: {},
      });
    } else {
      await prisma.categoryFix.deleteMany({ where: { category, subCategory } });
    }
  } catch {
    return NextResponse.json({ error: "Серверт хадгалж чадсангүй" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, category, subCategory, fixed });
}
