"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function EditionNavigation({ href }: { href: string }) {
  const pathname = usePathname();
  const links = [
    ["", "Тойм"], ["/browse", "Хариулттай"], ["/browse/unanswered", "Хариултгүй"],
    ["/v2", "Сургалт"], ["/quiz", "Шалгалт"], ["/history", "Түүх"], ["/calendar", "Календар"],
  ];
  return <nav aria-label="Энэ хувилбарын бэлтгэл" className="flex gap-1 overflow-x-auto pb-3">
    {links.map(([suffix, label]) => <Link key={suffix} href={`${href}${suffix}`} prefetch={false} aria-current={pathname === `${href}${suffix}` ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 py-2 text-xs font-medium transition-colors sm:text-sm ${pathname === `${href}${suffix}` ? "bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5"}`}>{label}</Link>)}
  </nav>;
}
