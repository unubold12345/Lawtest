import { prisma } from "@/lib/prisma";
import { PLAN_PRICE } from "@/lib/access";

const UB_OFFSET_MS = 8 * 60 * 60 * 1000;
const SERIES_MONTHS = 12;
export const COST_CATEGORIES = ["neon", "vercel", "custom"] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export type FinanceSummary = {
  ok: true;
  generatedAt: string;
  currency: "MNT";
  planPrice: number;
  allTime: {
    revenue: number;
    cost: number;
    profit: number;
    payments: number;
    marginPct: number | null;
  };
  current: {
    month: string;
    revenue: number;
    cost: number;
    profit: number;
    payments: number;
    marginPct: number | null;
  };
  series: {
    month: string;
    revenue: number;
    cost: number;
    profit: number;
    payments: number;
  }[];
  byCategory: Record<CostCategory, number>;
};

function ubMonth(date: Date): string {
  return new Date(date.getTime() + UB_OFFSET_MS).toISOString().slice(0, 7);
}

export function lastMonths(count = SERIES_MONTHS, now = new Date()): string[] {
  const shifted = new Date(now.getTime() + UB_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - (count - 1 - index), 1));
    return date.toISOString().slice(0, 7);
  });
}

function pct(profit: number, revenue: number): number | null {
  return revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null;
}

export async function getFinanceSummary(now = new Date()): Promise<FinanceSummary> {
  const [payments, costs] = await Promise.all([
    prisma.paymentRequest.findMany({
      where: { status: "APPROVED" },
      select: { createdAt: true, decidedAt: true },
    }),
    prisma.adminCost.findMany({
      select: { amount: true, category: true, month: true },
    }),
  ]);

  const currentMonth = lastMonths(1, now)[0];
  const months = lastMonths(SERIES_MONTHS, now);
  const byCategory: Record<CostCategory, number> = { neon: 0, vercel: 0, custom: 0 };
  let allTimeCost = 0;
  const costByMonth = new Map<string, number>();

  for (const cost of costs) {
    const amount = Number(cost.amount) || 0;
    allTimeCost += amount;
    costByMonth.set(cost.month, (costByMonth.get(cost.month) || 0) + amount);
    if (cost.category === "neon" || cost.category === "vercel" || cost.category === "custom") {
      byCategory[cost.category] += amount;
    }
  }

  const paymentsByMonth = new Map<string, number>();
  let currentPayments = 0;
  for (const payment of payments) {
    const month = ubMonth(payment.decidedAt ?? payment.createdAt);
    paymentsByMonth.set(month, (paymentsByMonth.get(month) || 0) + 1);
    if (month === currentMonth) currentPayments += 1;
  }

  const series = months.map((month) => {
    const count = paymentsByMonth.get(month) ?? 0;
    const revenue = count * PLAN_PRICE;
    const cost = costByMonth.get(month) ?? 0;
    return { month, revenue, cost, profit: revenue - cost, payments: count };
  });

  const currentRow = series[series.length - 1];
  const allTimeRevenue = payments.length * PLAN_PRICE;
  const allTimeProfit = allTimeRevenue - allTimeCost;

  return {
    ok: true,
    generatedAt: now.toISOString(),
    currency: "MNT",
    planPrice: PLAN_PRICE,
    allTime: {
      revenue: allTimeRevenue,
      cost: allTimeCost,
      profit: allTimeProfit,
      payments: payments.length,
      marginPct: pct(allTimeProfit, allTimeRevenue),
    },
    current: {
      month: currentMonth,
      revenue: currentRow.revenue,
      cost: currentRow.cost,
      profit: currentRow.profit,
      payments: currentPayments,
      marginPct: pct(currentRow.profit, currentRow.revenue),
    },
    series,
    byCategory,
  };
}
