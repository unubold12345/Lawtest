import fs from "node:fs";
import path from "node:path";
import { loadQuestions } from "@/lib/questions";
import Link from "next/link";
import HomeCategories from "@/components/HomeCategories";
import HomeBanner from "@/components/HomeBanner";
import HomeHero from "@/components/HomeHero";
import StatCounter from "@/components/StatCounter";
import { EXAM, examPhase } from "@/lib/exam";
import HomePlanPromo from "@/components/HomePlanPromo";

// static/ISR: per-user bits (promo/locks) are client-side so first paint is cached for everyone
export const revalidate = 300;

export default async function Home() {
  const { questions } = loadQuestions();
  const total = questions.length;
  const byMain = new Map<string, { total: number; subs: Map<string, number> }>();
  for (const q of questions) {
    const main = q.category || "Бусад";
    const sub = q.subCategory || "Ерөнхий";
    if (!byMain.has(main)) byMain.set(main, { total: 0, subs: new Map() });
    const g = byMain.get(main)!;
    g.total += 1;
    g.subs.set(sub, (g.subs.get(sub) || 0) + 1);
  }
  // show empty main categories (folders with no questions yet)
  try {
    const dataDir = path.join(process.cwd(), "data");
    for (const e of fs.readdirSync(dataDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (!byMain.has(e.name)) byMain.set(e.name, { total: 0, subs: new Map() });
    }
  } catch {}
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const mains = [...byMain.entries()]
    .sort((a, b) => collator.compare(a[0], b[0]))
    .map(([name, { total, subs }]) => ({
      name,
      total,
      subs: [...subs.entries()]
        .sort((a, b) => collator.compare(a[0], b[0]))
        .map(([subName, count]) => ({ name: subName, count })),
    }));
  const mainCount = mains.length;
  const subCount = mains.reduce((a, m) => a + m.subs.length, 0);
  const topMains = [...mains].sort((a, b) => b.total - a.total).slice(0, 3);
  const maxTop = topMains[0]?.total ?? 1;
  const phase = examPhase();
  const examStartEpoch = Date.parse(EXAM.examStartKey + "T00:00:00+08:00");
  const initialRemainingMs = Math.max(0, examStartEpoch - Date.now());

  return (
    <div className="mx-auto max-w-6xl px-2 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <HomeBanner />

      {phase !== "done" && (
        <HomeHero
          total={total}
          examStartEpoch={examStartEpoch}
          initialRemainingMs={initialRemainingMs}
          examDates={EXAM.dates}
          showSignup={phase === "open"}
          signupUrl={EXAM.signupUrl}
          signupLabel={EXAM.signupLabel}
        />
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-4">
        <div className="group relative overflow-hidden rounded-lg sm:rounded-xl border border-zinc-200 bg-white p-2.5 sm:p-4 dark:border-white/10 dark:bg-white/[0.04] text-center transition-colors hover:border-indigo-300 dark:hover:border-indigo-400/40">
          <p className="text-[17px] sm:text-2xl font-bold leading-none text-indigo-600 dark:text-indigo-300">
            <StatCounter value={total} />
          </p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Нийт сорилго</p>
        </div>
        <div className="group relative overflow-hidden rounded-lg sm:rounded-xl border border-zinc-200 bg-white p-2.5 sm:p-4 dark:border-white/10 dark:bg-white/[0.04] text-center transition-colors hover:border-violet-300 dark:hover:border-violet-400/40">
          <p className="text-[17px] sm:text-2xl font-bold leading-none text-violet-600 dark:text-violet-300">
            <StatCounter value={mainCount} />
          </p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Үндсэн ангилал</p>
        </div>
        <div className="group relative overflow-hidden rounded-lg sm:rounded-xl border border-zinc-200 bg-white p-2.5 sm:p-4 dark:border-white/10 dark:bg-white/[0.04] text-center transition-colors hover:border-sky-300 dark:hover:border-sky-400/40">
          <p className="text-[17px] sm:text-2xl font-bold leading-none text-sky-600 dark:text-sky-300">
            <StatCounter value={subCount} />
          </p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Дэд ангилал</p>
        </div>
        <div className="group relative overflow-hidden rounded-lg sm:rounded-xl border border-zinc-200 bg-white p-2.5 sm:p-4 dark:border-white/10 dark:bg-white/[0.04] text-center transition-colors hover:border-emerald-300 dark:hover:border-emerald-400/40">
          <p className="text-[17px] sm:text-2xl font-bold leading-none text-emerald-600 dark:text-emerald-300">
            <StatCounter value={2} />
          </p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Шалгалт + Сургалт</p>
        </div>
      </div>

      {/* TOP CATEGORIES */}
      {topMains.length > 0 && (
        <div className="rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-3 sm:p-6 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="font-semibold text-[13px] sm:text-lg">Их сорилготой ангилал</h2>
              <p className="mt-0.5 text-[11px] sm:text-xs text-zinc-500">Хамгийн олон сорилготой гурван ангилал</p>
            </div>
            <Link href="/browse" className="shrink-0 text-[11px] sm:text-sm text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-300">
              Бүгд →
            </Link>
          </div>
          <div className="mt-2 sm:mt-4 grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-3">
            {topMains.map((m, i) => (
              <Link
                key={m.name}
                href={`/browse?cat=${encodeURIComponent(m.name)}`}
                className="group rounded-lg sm:rounded-xl bg-zinc-50 border border-zinc-200 p-3 sm:p-4 hover:bg-zinc-100 hover:border-zinc-300 dark:bg-white/[0.04] dark:border-white/10 dark:hover:bg-indigo-500/10 dark:hover:border-indigo-400/40 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] sm:text-xs font-semibold text-zinc-400 dark:text-zinc-500 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] sm:text-xs text-zinc-500">{m.subs.length} дэд</span>
                </div>
                <p className="mt-1 font-bold text-[20px] sm:text-3xl leading-none">
                  <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-300 dark:to-violet-300">
                    {m.total.toLocaleString("mn-MN")}
                  </span>
                </p>
                <p className="mt-1.5 text-[12px] sm:text-sm font-medium leading-tight line-clamp-2">
                  {m.name}
                </p>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${Math.round((m.total / maxTop) * 100)}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* PLAN PROMO (hidden for paid users via client session) */}
      <HomePlanPromo />

      {/* CATEGORIES */}
      <div className="rounded-xl sm:rounded-2xl border border-dashed border-zinc-200 bg-white p-3 sm:p-6 dark:border-white/15 dark:bg-white/[0.03]">
        <div className="flex items-end justify-between gap-2">
          <div>
              <h2 className="font-semibold text-[13px] sm:text-base">Бүх ангилал</h2>
          </div>
          <Link href="/browse" className="shrink-0 text-[11px] sm:text-sm text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-300">
            Хайлт →
          </Link>
        </div>
        <HomeCategories mains={mains} />
      </div>

    </div>
  );
}
