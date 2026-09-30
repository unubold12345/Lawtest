"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Unit = { value: number; label: string };

export default function HomeHero({
  total,
  examStartEpoch,
  initialRemainingMs,
  examDates,
  showSignup,
  signupUrl,
  signupLabel,
}: {
  total: number;
  examStartEpoch: number;
  initialRemainingMs: number;
  examDates: string;
  showSignup: boolean;
  signupUrl: string;
  signupLabel: string;
}) {
  const [remainingMs, setRemainingMs] = useState<number>(initialRemainingMs);

  useEffect(() => {
    const id = setInterval(() => setRemainingMs(examStartEpoch - Date.now()), 1000);
    return () => clearInterval(id);
  }, [examStartEpoch]);

  const diff = Math.max(0, remainingMs);
  const units: Unit[] = [
    { value: Math.floor(diff / 86400000), label: "Өдөр" },
    { value: Math.floor((diff % 86400000) / 3600000), label: "Цаг" },
    { value: Math.floor((diff % 3600000) / 60000), label: "Минут" },
    { value: Math.floor((diff % 60000) / 1000), label: "Секунд" },
  ];
  const showCountdown = initialRemainingMs > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-5 sm:p-8 lg:p-10 dark:border-indigo-400/20 dark:bg-white/[0.03] dark:bg-gradient-to-br dark:from-indigo-500/[0.14] dark:via-white/[0.02] dark:to-violet-500/[0.12] motion-safe:animate-[fadeUp_500ms_ease-out]">
      {/* ambient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-500/20"
      />

      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
            Lexlab · 2026
          </p>
          <h1 className="mt-2.5 text-[26px] sm:text-4xl lg:text-5xl font-extrabold leading-[1.08] tracking-tight">
            Шалгалтандаа{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-indigo-300">
              итгэлтэй
            </span>{" "}
            бэлд
          </h1>
          <p className="mt-2.5 sm:mt-3 max-w-xl text-[13px] sm:text-base text-zinc-600 dark:text-zinc-400">
            {total.toLocaleString("mn-MN")} бодит сорилгоор давтаж, алдаагаа шинжилж,
            шалгалт болон сургалтын горимоор өдөр бүр бэлдээрэй.
          </p>

          <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-2.5">
            <Link
              href="/quiz"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-indigo-600 px-6 text-[13px] sm:text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400"
            >
              Шалгалт эхлэх <span aria-hidden>→</span>
            </Link>
            <Link
              href="/browse"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white px-6 text-[13px] sm:text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/10"
            >
              Сорилго үзэх
            </Link>
          </div>
        </div>

        {showCountdown && (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3.5 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                Шалгалт эхлэхэд
              </p>
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-500">{examDates}</p>
            </div>
            <div className="mt-2.5 grid grid-cols-4 gap-1.5 sm:gap-2">
              {units.map((u) => (
                <div
                  key={u.label}
                  className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white px-1 py-2 sm:px-2 sm:py-3 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <span
                    key={`${u.label}-${u.value}`}
                    className="text-xl sm:text-3xl font-extrabold leading-none tabular-nums text-zinc-900 dark:text-white motion-safe:animate-[tickIn_300ms_ease-out]"
                  >
                    {String(u.value).padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-[9px] sm:text-[11px] text-zinc-500 dark:text-zinc-400">
                    {u.label}
                  </span>
                </div>
              ))}
            </div>
            {showSignup && (
              <a
                href={signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-full bg-indigo-600 px-4 text-[12px] sm:text-sm font-medium text-white transition-colors hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500"
              >
                {signupLabel} <span aria-hidden>→</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
