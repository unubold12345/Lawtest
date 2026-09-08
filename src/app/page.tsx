import fs from "node:fs";
import path from "node:path";
import { loadQuestions } from "@/lib/questions";
import Link from "next/link";

export default function Home() {
  const { questions, sources } = loadQuestions();
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
  const cats = [...byMain.keys()];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="rounded-2xl border bg-white p-8 dark:bg-zinc-900 dark:border-zinc-800">
        <h1 className="text-3xl font-bold">Хуулийн шалгалтад бэлд</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {total} асуулт · {cats.join(" · ")} · Бүх асуултыг үзэх эсвэл шалгалт өгөх боломжтой.
        </p>

        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-sm text-zinc-500">Нийт асуулт</p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
            <p className="text-2xl font-bold">{cats.length}</p>
            <p className="text-sm text-zinc-500">Ангилал</p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
            <p className="text-2xl font-bold">{sources.find((s) => s.file === "questions.json")?.count ?? total}</p>
            <p className="text-sm text-zinc-500">questions.json</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/browse" className="rounded-full bg-zinc-900 px-7 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
            Бүх асуулт үзэх →
          </Link>
          <Link href="/quiz" className="rounded-full border px-7 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Шалгалт эхлэх
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
        <h3 className="font-semibold">Ангилал</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[...byMain.entries()].map(([main, { total: t, subs }]) => (
            <div key={main} className={`rounded-xl border p-4 ${t === 0 ? "bg-amber-50/60 border-amber-200 dark:bg-zinc-800 dark:border-zinc-700" : "bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700"}`}>
              <Link href={`/browse?cat=${encodeURIComponent(main)}`} className="font-semibold hover:underline">
                {main} · {t}
              </Link>
              {t === 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">хоосон</span>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {subs.size === 0 ? (
                  <span className="text-xs text-zinc-400">Дэд ангилал байхгүй — асуулт нэмнэ үү</span>
                ) : (
                  [...subs.entries()].map(([sub, n]) => (
                    <Link key={sub} href={`/browse?cat=${encodeURIComponent(main)}&sub=${encodeURIComponent(sub)}`} className="rounded-full bg-white border px-3 py-1 text-xs hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-600">
                      {sub} · {n}
                    </Link>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
