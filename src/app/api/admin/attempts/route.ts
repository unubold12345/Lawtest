import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const url = new URL(req.url);
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || "20", 10) || 20, 1), 100);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1);
  const [total, attempts] = await Promise.all([
    prisma.attempt.count(),
    prisma.attempt.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { phone: true, email: true } } },
    }),
  ]);
  return NextResponse.json({ attempts, total, page, pageSize });
}
