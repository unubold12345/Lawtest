import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const where = status === "OPEN" || status === "RESOLVED" ? { status } : {};
  const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "20", 10) || 20, 1), 100);
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
  const [reports, total, open] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    }),
    prisma.report.count({ where }),
    prisma.report.count({ where: { status: "OPEN" } }),
  ]);
  return NextResponse.json({ reports, total, open, page, pageSize });
}
