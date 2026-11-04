"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { suffix: "", label: "Тойм", icon: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z" },
  { suffix: "/browse", label: "Хариулттай сорилго", icon: "M12 6v15 M3 4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z" },
  { suffix: "/browse/unanswered", label: "Хариултгүй сорилго", icon: "M9 9a3 3 0 0 1 6 0c0 2-3 2-3 3 M12 17h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" },
  { suffix: "/v2", label: "Сургалтын төв", icon: "m2 9 10-5 10 5-10 5z M6 11v6c4 3 8 3 12 0v-6 M22 9v7" },
  { suffix: "/quiz", label: "Шалгалт өгөх", icon: "M9 4H5v17h14V4h-4 M9 3h6v4H9z m-1 11 3 3 5-6" },
  { suffix: "/history", label: "Шалгалтын түүх", icon: "M3 4v5h5 M3 9a9 9 0 1 1 1 9 M12 7v5l3 2" },
  { suffix: "/calendar", label: "Календар", icon: "M4 5h16v16H4z M16 3v4 M8 3v4 M4 11h16 M8 15h2 M14 15h2" },
];

function NavigationLinks({ href, pathname }: { href: string; pathname: string }) {
  return <nav aria-label="Энэ хувилбарын бэлтгэл" className="space-y-1 p-3">
    {links.map(({ suffix, label, icon }) => {
      const active = pathname === `${href}${suffix}`;
      return <Link key={suffix} href={`${href}${suffix}`} prefetch={false} aria-current={active ? "page" : undefined} onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")} className={`flex min-h-11 items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${active ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" : "border-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"}`}>
        <svg aria-hidden viewBox="0 0 24 24" className={`h-[18px] w-[18px] shrink-0 ${active ? "text-indigo-500 dark:text-indigo-300" : "text-zinc-400 dark:text-zinc-500"}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
        <span>{label}</span>
      </Link>;
    })}
  </nav>;
}

export default function EditionNavigation({ href }: { href: string }) {
  const pathname = usePathname();
  const activeLabel = links.find(({ suffix }) => pathname === `${href}${suffix}`)?.label || "Бэлтгэлийн цэс";
  return <aside aria-label="Бэлтгэлийн хажуугийн цэс" className="border-b border-zinc-200 bg-white dark:border-white/10 dark:bg-[#0b0b12] lg:sticky lg:top-[calc(65px+env(safe-area-inset-top))] lg:h-[calc(100dvh-65px-env(safe-area-inset-top))] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r">
    <div className="hidden lg:block">
      <p className="border-b border-zinc-100 bg-zinc-50 px-5 py-4 text-[11px] font-semibold tracking-[0.12em] text-zinc-500 dark:border-white/5 dark:bg-white/[0.025] dark:text-zinc-400">ШУУРХАЙ ЦЭС</p>
      <NavigationLinks href={href} pathname={pathname} />
    </div>
    <details key={pathname} className="group lg:hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2"><svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16 M4 12h16 M4 18h16" /></svg><span className="text-zinc-500">Цэс</span><span className="text-zinc-300 dark:text-zinc-600">/</span>{activeLabel}</span>
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <NavigationLinks href={href} pathname={pathname} />
    </details>
  </aside>;
}
