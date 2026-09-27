import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const [user, attempts, saved, notes, mistakes, mistakeAgg, attemptsRaw] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, phone: true, email: true, role: true, paidAt: true, createdAt: true, password: true },
    }),
    prisma.attempt.aggregate({ where: { userId }, _count: { _all: true }, _sum: { score: true, total: true } }),
    prisma.savedAnswer.count({ where: { userId } }),
    prisma.questionNote.count({ where: { userId } }),
    prisma.mistake.count({ where: { userId } }),
    prisma.mistake.aggregate({ where: { userId }, _sum: { wrongCount: true } }),
    prisma.attempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, category: true, mode: true, score: true, total: true, elapsed: true, createdAt: true },
    }),
  ]);
  if (!user) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  const total = attempts._sum.total ?? 0;
  return NextResponse.json({
    name: user.name,
    phone: user.phone,
    email: user.email && !user.email.endsWith("@phone.local") ? user.email : null,
    role: user.role,
    paidAt: user.paidAt ? user.paidAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    hasPassword: !!user.password,
    stats: {
      attempts: attempts._count._all,
      avgPct: total > 0 ? Math.round(((attempts._sum.score ?? 0) / total) * 100) : null,
      saved,
      notes,
      mistakes,
    },
    mistakesWrongCount: mistakeAgg._sum.wrongCount ?? 0,
    attemptsRaw: attemptsRaw.map((a) => ({
      id: a.id,
      category: a.category,
      mode: a.mode,
      score: a.score,
      total: a.total,
      elapsed: a.elapsed,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

const NAME_RE = /^[\p{L}][\p{L}\p{N} ._'\u2019-]{1,23}$/u;

export async function PATCH(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  const name = String(body?.name ?? "").trim().replace(/\s+/g, " ");
  if (!NAME_RE.test(name)) {
    return NextResponse.json({ error: "Нэр 2–24 тэмдэгт, үсгээр эхлэх ёстой" }, { status: 400 });
  }
  await prisma.user.update({ where: { id: userId }, data: { name } });
  return NextResponse.json({ ok: true, name });
}
