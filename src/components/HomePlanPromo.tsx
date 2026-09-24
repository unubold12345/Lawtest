"use client";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function HomePlanPromo() {
  const { data: session } = useSession();
  const user = session?.user as unknown as { hasPaid?: boolean; role?: string } | undefined;
  const paid = user?.hasPaid === true || user?.role === "ADMIN";
  if (paid) return null;

  return (
    <div className="home-plan-promo rounded-xl sm:rounded-2xl border border-zinc-900 bg-zinc-950 p-3.5 sm:p-5 text-white dark:border-indigo-400/25 dark:bg-gradient-to-br dark:from-indigo-600/25 dark:via-[#0d0d18]/80 dark:to-violet-600/20">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[14px] sm:text-lg tracking-tight flex items-center gap-1.5">
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="shrink-0 text-indigo-400"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 7.9-1" />
            </svg>
            Бүтэн эрх — 39,900₮
          </p>
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
  );
}
