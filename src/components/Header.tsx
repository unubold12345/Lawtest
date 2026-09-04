"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export default function Header({ total }: { total: number }) {
  const { data: session } = useSession();
  const user = session?.user;
  const pathname = usePathname();
  const linkCls = (href: string) =>
    `px-3 py-2 rounded-full text-sm font-medium transition-colors ${pathname === href ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"}`;

  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur dark:bg-zinc-900/80 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            LawTest <span className="ml-2 text-xs font-normal text-zinc-500">{total} асуулт</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            <Link href="/browse" className={linkCls("/browse")}>Бүх асуулт</Link>
            <Link href="/quiz" className={linkCls("/quiz")}>Шалгалт</Link>
            <Link href="/history" className={linkCls("/history")}>Түүх</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden sm:inline text-sm text-zinc-600 dark:text-zinc-400">{user.name || user.email}</span>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="rounded-full border px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                Гарах
              </button>
            </>
          ) : (
            <Link href="/login" className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
              Нэвтрэх
            </Link>
          )}
        </div>
      </div>
      <div className="sm:hidden flex gap-1 px-6 pb-3">
        <Link href="/browse" className={linkCls("/browse")}>Бүх асуулт</Link>
        <Link href="/quiz" className={linkCls("/quiz")}>Шалгалт</Link>
        <Link href="/history" className={linkCls("/history")}>Түүх</Link>
      </div>
    </header>
  );
}
