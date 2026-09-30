import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

const DAY = 24 * 60 * 60 * 1000;
const DAYS = 30;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const now = new Date();
  const since = new Date(now.getTime() - DAYS * DAY);
  const todayK = dayKey(now);
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const dayAgo = new Date(now.getTime() - 1 * DAY);

  const [pageViews, users, paid, attemptGroups, dauRows, wauRows, mauRows, attempts30d, users30d] =
    await Promise.all([
      prisma.pageView.findMany({
        where: { createdAt: { gte: since } },
        select: { path: true, sessionId: true, userId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 50000,
      }),
      prisma.user.count(),
      prisma.user.count({ where: { paidAt: { not: null } } }),
      // per-user attempt counts + last attempt (for buckets)
      prisma.attempt.groupBy({
        by: ["userId"],
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.attempt.findMany({
        where: { createdAt: { gte: dayAgo } },
        select: { userId: true },
        take: 20000,
      }),
      prisma.attempt.findMany({
        where: { createdAt: { gte: weekAgo } },
        select: { userId: true },
        take: 20000,
      }),
      prisma.attempt.findMany({
        where: { createdAt: { gte: since } },
        select: { userId: true },
        take: 20000,
      }),
      prisma.attempt.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 50000,
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 20000,
      }),
    ]);

  // ---- visits aggregation ----
  const perDayMap = new Map<string, { views: number; sessions: Set<string> }>();
  const sessionsAll = new Set<string>();
  const pathCounts = new Map<string, number>();
  let guestViews = 0;
  let memberViews = 0;
  let todayViews = 0;
  const todaySessions = new Set<string>();
  for (let i = 0; i < DAYS; i++) {
    perDayMap.set(dayKey(new Date(now.getTime() - (DAYS - 1 - i) * DAY)), { views: 0, sessions: new Set() });
  }
  for (const v of pageViews) {
    const k = dayKey(v.createdAt);
    const slot = perDayMap.get(k);
    if (slot) {
      slot.views += 1;
      slot.sessions.add(v.sessionId);
    }
    sessionsAll.add(v.sessionId);
    pathCounts.set(v.path, (pathCounts.get(v.path) || 0) + 1);
    if (v.userId) memberViews += 1;
    else guestViews += 1;
    if (k === todayK) {
      todayViews += 1;
      todaySessions.add(v.sessionId);
    }
  }
  const perDay = [...perDayMap.entries()].map(([day, s]) => ({ day, views: s.views, uniques: s.sessions.size }));
  const topPages = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, views]) => ({ path, views }));

  // ---- signups per day ----
  const newMap = new Map<string, number>();
  for (let i = 0; i < DAYS; i++) newMap.set(dayKey(new Date(now.getTime() - (DAYS - 1 - i) * DAY)), 0);
  for (const u of users30d) newMap.set(dayKey(u.createdAt), (newMap.get(dayKey(u.createdAt)) || 0) + 1);
  const newPerDay = [...newMap.entries()].map(([day, count]) => ({ day, count }));
  const newToday = newMap.get(todayK) || 0;
  let new7d = 0;
  for (const u of users30d) if (u.createdAt >= weekAgo) new7d += 1;

  // ---- engagement ----
  const dau = new Set(dauRows.map((r) => r.userId)).size;
  const wau = new Set(wauRows.map((r) => r.userId)).size;
  const mau = new Set(mauRows.map((r) => r.userId)).size;
  const attMap = new Map<string, number>();
  for (let i = 0; i < DAYS; i++) attMap.set(dayKey(new Date(now.getTime() - (DAYS - 1 - i) * DAY)), 0);
  for (const a of attempts30d) attMap.set(dayKey(a.createdAt), (attMap.get(dayKey(a.createdAt)) || 0) + 1);
  const attemptsPerDay = [...attMap.entries()].map(([day, count]) => ({ day, count }));

  const attemptedUsers = new Set(attemptGroups.map((g) => g.userId));
  let singleTry = 0;
  let idle30d = 0;
  let active7dUsers = 0;
  for (const g of attemptGroups) {
    if (g._count._all === 1) singleTry += 1;
    const last = g._max.createdAt;
    if (last && last < weekAgo) {
      // counted in idle30d only when older than 30d; active7d tracked separately
    }
    if (last && last >= weekAgo) active7dUsers += 1;
    else if (last && last < since) idle30d += 1;
  }
  const dormant = Math.max(0, users - attemptedUsers.size);
  const totalAttempts = attemptGroups.reduce((s, g) => s + g._count._all, 0);
  const avgAttempts = users > 0 ? Math.round((totalAttempts / users) * 10) / 10 : 0;

  return NextResponse.json({
    visits: {
      total30d: pageViews.length,
      unique30d: sessionsAll.size,
      todayViews,
      todayUniques: todaySessions.size,
      perDay,
      topPages,
      guestViews,
      memberViews,
    },
    users: { total: users, paid, newToday, new7d, newPerDay },
    engagement: {
      dau,
      wau,
      mau,
      attemptsPerDay,
      buckets: { active7d: active7dUsers, singleTry, dormant, idle30d },
      avgAttempts,
      paidRate: users > 0 ? Math.round((paid / users) * 1000) / 10 : 0,
      totalAttempts,
    },
  });
}
