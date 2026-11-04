import Link from "next/link";
import { LAWYER_2026_PATH } from "@/lib/catalog";

export default function EditionLayout({ children }: { children: React.ReactNode }) {
  return <>
    <div className="border-b border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs sm:px-6">
        <div className="flex flex-wrap items-center gap-2"><Link href="/exams" className="text-zinc-500 hover:underline">Шалгалтын сан</Link><span className="text-zinc-400">/</span><Link href={LAWYER_2026_PATH} className="font-semibold">Хуульчийн шалгалт <span className="ml-1 rounded bg-indigo-100 px-2 py-1 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">2026</span></Link></div>
        <Link href="/plans/lawyer-2026-full" className="text-zinc-500 hover:underline">Энэ хувилбарын эрх →</Link>
      </div>
    </div>
    {children}
  </>;
}
