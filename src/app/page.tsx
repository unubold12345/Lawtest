import fs from "node:fs";
import path from "node:path";
import { loadQuestions } from "@/lib/questions";
import Link from "next/link";
import HomeCategories from "@/components/HomeCategories";
import { EXAM, examPhase } from "@/lib/exam";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  // paid-plan access (free users see lock badges + promo)
  let hasAccess = false;
  try {
    const session = await auth();
    const userId = (session?.user as unknown as { id?: string })?.id;
    if (userId) {
      const db = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, paidAt: true } });
      hasAccess = !!db && (db.role === "ADMIN" || !!db.paidAt);
    }
  } catch {}

  const phase = examPhase();

  return (
    <div className="mx-auto max-w-6xl px-2 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
      {/* EXAM INFO (auto-hides after the exam; signup link hides after reg closes) */}
      {phase !== "done" && (
      <div className="rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-3.5 sm:p-5 dark:border-indigo-400/20 dark:bg-white/[0.03] dark:bg-gradient-to-br dark:from-indigo-500/[0.14] dark:via-white/[0.02] dark:to-violet-500/[0.10]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-indigo-300/90">
              {EXAM.label}
            </p>
            <p className="mt-1 font-bold text-[17px] sm:text-2xl tracking-tight">
              {EXAM.dates}
            </p>
            <p className="mt-0.5 text-[11px] sm:text-sm text-zinc-500 dark:text-zinc-400">
              {phase === "open" ? EXAM.regOpenText : EXAM.regClosedText}
            </p>
          </div>
          {phase === "open" && (
          <a
            href={EXAM.signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2.5 text-[12px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 transition-colors dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[38px]"
          >
            {EXAM.signupLabel} <span aria-hidden>→</span>
          </a>
          )}
        </div>
      </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-4">
        <div className="rounded-lg sm:rounded-xl border border-zinc-200 bg-white p-2.5 sm:p-4 dark:border-white/10 dark:bg-white/[0.04] text-center">
          <p className="text-[17px] sm:text-2xl font-bold leading-none text-indigo-600 dark:text-indigo-300">{total}</p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Нийт сорилго</p>
        </div>
        <div className="rounded-lg sm:rounded-xl border border-zinc-200 bg-white p-2.5 sm:p-4 dark:border-white/10 dark:bg-white/[0.04] text-center">
          <p className="text-[17px] sm:text-2xl font-bold leading-none text-violet-600 dark:text-violet-300">{mainCount}</p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Үндсэн ангилал</p>
        </div>
        <div className="rounded-lg sm:rounded-xl border border-zinc-200 bg-white p-2.5 sm:p-4 dark:border-white/10 dark:bg-white/[0.04] text-center">
          <p className="text-[17px] sm:text-2xl font-bold leading-none text-sky-600 dark:text-sky-300">{subCount}</p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Дэд ангилал</p>
        </div>
        <div className="rounded-lg sm:rounded-xl border border-zinc-200 bg-white p-2.5 sm:p-4 dark:border-white/10 dark:bg-white/[0.04] text-center">
          <p className="text-[17px] sm:text-2xl font-bold leading-none text-emerald-600 dark:text-emerald-300">2</p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Шалгалт + Сургалт</p>
        </div>
      </div>

      {/* TOP CATEGORIES */}
      {topMains.length > 0 && (
        <div className="rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-3 sm:p-6 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="font-semibold text-[13px] sm:text-lg">Их сорилготой ангилал</h2>
            </div>
            <Link href="/browse" className="shrink-0 text-[11px] sm:text-sm text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-300">
              Бүгд →
            </Link>
          </div>
          <div className="mt-2 sm:mt-4 grid grid-cols-3 gap-1.5 sm:gap-3">
            {topMains.map((m) => (
              <Link
                key={m.name}
                href={`/browse?cat=${encodeURIComponent(m.name)}`}
                className="rounded-lg sm:rounded-xl bg-zinc-50 border border-zinc-200 p-2.5 sm:p-4 text-center hover:bg-zinc-100 hover:border-zinc-300 dark:bg-white/[0.04] dark:border-white/10 dark:hover:bg-indigo-500/10 dark:hover:border-indigo-400/40 transition-colors"
              >
                <p className="font-bold text-[15px] sm:text-2xl leading-none">{m.total}</p>
                <p className="mt-1 text-[10px] sm:text-sm font-medium leading-tight line-clamp-2">{m.name}</p>
                <p className="mt-0.5 text-[10px] sm:text-xs text-zinc-500">{m.subs.length} дэд</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* PLAN PROMO (unpaid users) */}
      {!hasAccess && (
        <div className="rounded-xl sm:rounded-2xl border border-zinc-900 bg-zinc-950 p-3.5 sm:p-5 text-white dark:border-indigo-400/25 dark:bg-gradient-to-br dark:from-indigo-600/25 dark:via-[#0d0d18]/80 dark:to-violet-600/20">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-6">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[14px] sm:text-lg tracking-tight">🔓 Бүтэн эрх — 39,900₮</p>
              <p className="mt-0.5 text-[11px] sm:text-sm text-zinc-300">
                Нэг удаа төлөөд бүх ангилал, хадгалах цэсийг насан туршдаа нээнэ
              </p>
            </div>
            <Link
              href="/plan"
              className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[12px] sm:text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[38px]"
            >
              Эрх авах →
            </Link>
          </div>
        </div>
      )}

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
        <HomeCategories mains={mains} hasAccess={hasAccess} />
      </div>

    </div>
  );
}
