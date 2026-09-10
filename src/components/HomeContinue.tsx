"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Attempt = {
  id: string;
  date: string;
  category: string;
  mode: string;
  score: number;
  total: number;
  elapsed: number;
};

export default function HomeContinue() {
  const [last, setLast] = useState<Attempt | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("lawtest_attempts");
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) setLast(arr[0]);
    } catch {}
  }, []);
  if (!last) return null;
  const pct = last.total ? Math.round((last.score / last.total) * 100) : 0;
  return (
    <Link
      href="/history"
      className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 sm:px-4 sm:py-3 dark:bg-zinc-800 dark:border-zinc-700 hover:border-zinc-400 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-[11px] sm:text-xs text-zinc-500">Сүүлийн шалгалт</p>
        <p className="text-[13px] sm:text-sm font-medium truncate">
          {last.category} · {last.score}/{last.total} ({pct}%)
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] sm:text-xs font-medium text-white dark:bg-white dark:text-zinc-900">
        Түүх →
      </span>
    </Link>
  );
}
