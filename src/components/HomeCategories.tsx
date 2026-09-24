"use client";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { FREE_CATEGORY } from "@/lib/access";

type Sub = { name: string; count: number };
type Main = { name: string; total: number; subs: Sub[] };

export default function HomeCategories({ mains }: { mains: Main[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data: session } = useSession();
  const user = session?.user as unknown as { hasPaid?: boolean; role?: string } | undefined;
  const paid = user?.hasPaid === true || user?.role === "ADMIN";
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
        const locked = !paid && main !== FREE_CATEGORY;
        return (
          <div
            key={main}
            className={`rounded-lg sm:rounded-xl border p-3 sm:p-4 transition-colors ${t === 0 ? "bg-amber-50/60 border-amber-200 dark:bg-amber-400/[0.06] dark:border-amber-400/20" : "bg-zinc-50 border-zinc-200 hover:border-zinc-300 dark:bg-white/[0.04] dark:border-white/10 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/10"}`}
          >
            <Link href={`/browse?cat=${encodeURIComponent(main)}`} className="font-semibold hover:underline text-[13px] sm:text-base">
              {locked && <span aria-label="төлбөртэй" className="cat-lock">🔒 </span>}{main} <span className="font-normal text-zinc-500">· {t}</span>
            </Link>
            {t === 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                хоосон
              </span>
            )}
            <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-1 sm:gap-1.5">
              {subs.length === 0 ? (
                <span className="text-[11px] sm:text-xs text-zinc-400">Дэд ангилал байхгүй — сорилго нэмнэ үү</span>
              ) : (
                visible.map(({ name: sub, count: n }) => (
                  <Link
                    key={sub}
                    href={`/browse?cat=${encodeURIComponent(main)}&sub=${encodeURIComponent(sub)}`}
                    className="rounded-full bg-white border border-zinc-200 px-2 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs hover:bg-zinc-50 dark:bg-white/[0.06] dark:border-white/10 dark:hover:bg-indigo-500/15 dark:hover:border-indigo-400/30 dark:hover:text-indigo-200 transition-colors"
                  >
                    {sub} · {n}
                  </Link>
                ))
              )}
            </div>
            {subs.length > LIMIT && (
              <button
                onClick={() => toggle(main)}
                className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs font-medium text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-300"
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
