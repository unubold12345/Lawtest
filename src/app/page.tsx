import fs from "node:fs";
import path from "node:path";
import { loadQuestions } from "@/lib/questions";
import Link from "next/link";
import HomeCategories from "@/components/HomeCategories";

export default function Home() {
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

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
      {/* EXAM INFO */}
      <div className="rounded-xl sm:rounded-2xl border bg-white p-3.5 sm:p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
              Хуульчийн шалгалт · 2026
            </p>
            <p className="mt-1 font-bold text-[17px] sm:text-2xl tracking-tight">
              10-р сарын 28, 29, 30
            </p>
            <p className="mt-0.5 text-[11px] sm:text-sm text-zinc-500">
              Бүртгэл 9-р сарын 27-нд хаагдана
            </p>
          </div>
          <a
            href="https://burtgel.mglbar.mn/"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2.5 text-[12px] sm:text-sm font-medium text-white hover:bg-zinc-700 transition-colors dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 min-h-[38px]"
          >
            burtgel.mglbar.mn <span aria-hidden>→</span>
          </a>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-4">
        <div className="rounded-lg sm:rounded-xl border bg-white p-2.5 sm:p-4 dark:bg-zinc-900 dark:border-zinc-800 text-center">
          <p className="text-[17px] sm:text-2xl font-bold leading-none">{total}</p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Нийт асуулт</p>
        </div>
        <div className="rounded-lg sm:rounded-xl border bg-white p-2.5 sm:p-4 dark:bg-zinc-900 dark:border-zinc-800 text-center">
          <p className="text-[17px] sm:text-2xl font-bold leading-none">{mainCount}</p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Үндсэн ангилал</p>
        </div>
        <div className="rounded-lg sm:rounded-xl border bg-white p-2.5 sm:p-4 dark:bg-zinc-900 dark:border-zinc-800 text-center">
          <p className="text-[17px] sm:text-2xl font-bold leading-none">{subCount}</p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Дэд ангилал</p>
        </div>
        <div className="rounded-lg sm:rounded-xl border bg-white p-2.5 sm:p-4 dark:bg-zinc-900 dark:border-zinc-800 text-center">
          <p className="text-[17px] sm:text-2xl font-bold leading-none">2</p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Шалгалт + Сургалт</p>
        </div>
      </div>

      {/* TOP CATEGORIES */}
      {topMains.length > 0 && (
        <div className="rounded-xl sm:rounded-2xl border bg-white p-3 sm:p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="font-semibold text-[13px] sm:text-lg">Их асуулттай ангилал</h2>
            </div>
            <Link href="/browse" className="shrink-0 text-[11px] sm:text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
              Бүгд →
            </Link>
          </div>
          <div className="mt-2 sm:mt-4 grid grid-cols-3 gap-1.5 sm:gap-3">
            {topMains.map((m) => (
              <Link
                key={m.name}
                href={`/browse?cat=${encodeURIComponent(m.name)}`}
                className="rounded-lg sm:rounded-xl bg-zinc-50 border p-2.5 sm:p-4 text-center hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700 transition-colors"
              >
                <p className="font-bold text-[15px] sm:text-2xl leading-none">{m.total}</p>
                <p className="mt-1 text-[10px] sm:text-sm font-medium leading-tight line-clamp-2">{m.name}</p>
                <p className="mt-0.5 text-[10px] sm:text-xs text-zinc-500">{m.subs.length} дэд</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* CATEGORIES */}
      <div className="rounded-xl sm:rounded-2xl border border-dashed bg-white p-3 sm:p-6 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-end justify-between gap-2">
          <div>
              <h2 className="font-semibold text-[13px] sm:text-base">Бүх ангилал</h2>
          </div>
          <Link href="/browse" className="shrink-0 text-[11px] sm:text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            Хайлт →
          </Link>
        </div>
        <HomeCategories mains={mains} />
      </div>

    </div>
  );
}
