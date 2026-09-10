import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const where = status === "OPEN" || status === "RESOLVED" ? { status } : {};
  const reports = await prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
  });
  const open = await prisma.report.count({ where: { status: "OPEN" } });
  return NextResponse.json({ reports, open });
}
