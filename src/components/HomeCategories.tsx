"use client";
import Link from "next/link";
import { useState } from "react";

type Sub = { name: string; count: number };
type Main = { name: string; total: number; subs: Sub[] };

export default function HomeCategories({ mains }: { mains: Main[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const LIMIT = 6;

  function toggle(main: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(main)) next.delete(main);
      else next.add(main);
      return next;
    });
  }

  return (
    <div className="mt-3 sm:mt-4 grid gap-2 sm:gap-4 grid-cols-1 sm:grid-cols-2">
      {mains.map(({ name: main, total: t, subs }) => {
        const isExpanded = expanded.has(main);
        const visible = isExpanded ? subs : subs.slice(0, LIMIT);
        const hidden = subs.length - visible.length;
        return (
          <div
            key={main}
            className={`rounded-lg sm:rounded-xl border p-3 sm:p-4 ${t === 0 ? "bg-amber-50/60 border-amber-200 dark:bg-zinc-800 dark:border-zinc-700" : "bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700"}`}
          >
            <Link href={`/browse?cat=${encodeURIComponent(main)}`} className="font-semibold hover:underline text-[13px] sm:text-base">
              {main} <span className="font-normal text-zinc-500">· {t}</span>
            </Link>
            {t === 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                хоосон
              </span>
            )}
            <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-1 sm:gap-1.5">
              {subs.length === 0 ? (
                <span className="text-[11px] sm:text-xs text-zinc-400">Дэд ангилал байхгүй — асуулт нэмнэ үү</span>
              ) : (
                visible.map(({ name: sub, count: n }) => (
                  <Link
                    key={sub}
                    href={`/browse?cat=${encodeURIComponent(main)}&sub=${encodeURIComponent(sub)}`}
                    className="rounded-full bg-white border px-2 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-600"
                  >
                    {sub} · {n}
                  </Link>
                ))
              )}
            </div>
            {subs.length > LIMIT && (
              <button
                onClick={() => toggle(main)}
                className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                {isExpanded ? "Хураах ↑" : `+${hidden} илүү үзэх ↓`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
