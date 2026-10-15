import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

const DAY = 24 * 60 * 60 * 1000;
const UB_OFFSET_MS = 8 * 60 * 60 * 1000;
const userSel = { select: { phone: true, email: true, name: true } };

type Who = { phone: string | null; email: string; name: string | null };
const who = (u: Who) => u.phone || u.email || u.name || "—";

// Admin "Идэвх" tab: live /v2 presence + today's run milestones + feed.
export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const now = new Date();
  const ubDay = new Date(now.getTime() + UB_OFFSET_MS).toISOString().slice(0, 10);
  const dayStart = new Date(`${ubDay}T00:00:00+08:00`);
  const yStart = new Date(dayStart.getTime() - DAY);
  const activeSince = new Date(now.getTime() - 2 * 60 * 1000);
  const recentSince = new Date(now.getTime() - DAY);

  const [presences, eventsToday, yGroups, viewsToday, yViews] = await Promise.all([
    prisma.studyPresence.findMany({
      where: { updatedAt: { gte: recentSince } },
      include: { user: userSel },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.studyEvent.findMany({
      where: { createdAt: { gte: dayStart } },
      include: { user: userSel },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.studyEvent.groupBy({
      by: ["type"],
      where: { createdAt: { gte: yStart, lt: dayStart } },
      _count: { _all: true },
    }),
    prisma.pageView.findMany({
      where: { path: "/v2", createdAt: { gte: dayStart } },
      select: { sessionId: true, userId: true },
      take: 20000,
    }),
    prisma.pageView.count({ where: { path: "/v2", createdAt: { gte: yStart, lt: dayStart } } }),
  ]);

  const presenceRow = (p: (typeof presences)[number]) => ({
    phone: who(p.user),
    state: p.state,
    mode: p.mode,
    label: p.label,
    idx: p.idx,
    total: p.total,
    answered: p.answered,
    updatedAt: p.updatedAt,
  });

  const started = eventsToday.filter((e) => e.type === "run_start").length;
  const studyStarted = eventsToday.filter((e) => e.type === "run_start" && e.mode === "study").length;
  const yMap = new Map(yGroups.map((g) => [g.type, g._count._all]));

  return NextResponse.json({
    now: now.toISOString(),
    active: presences.filter((p) => p.updatedAt >= activeSince).map(presenceRow),
    recent: presences.map(presenceRow),
    today: {
      v2Views: viewsToday.length,
      v2Uniques: new Set(viewsToday.map((v) => v.sessionId)).size,
      v2Members: viewsToday.filter((v) => v.userId).length,
      activeUsers24h: presences.length,
      started,
      finished: eventsToday.filter((e) => e.type === "run_finish").length,
      studyStarted,
      examStarted: started - studyStarted,
      yStarted: yMap.get("run_start") || 0,
      yFinished: yMap.get("run_finish") || 0,
      yViews,
    },
    feed: eventsToday.slice(0, 30).map((e) => ({
      id: e.id,
      phone: who(e.user),
      type: e.type,
      mode: e.mode,
      label: e.label,
      total: e.total,
      score: e.score,
      createdAt: e.createdAt,
    })),
  });
}
