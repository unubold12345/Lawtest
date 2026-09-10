import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const url = new URL(req.url);
  const take = Math.min(parseInt(url.searchParams.get("take") || "50", 10) || 50, 100);
  const attempts = await prisma.attempt.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { phone: true, email: true } } },
  });
  return NextResponse.json({ attempts });
}
