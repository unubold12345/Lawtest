"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export default function Header({ total }: { total: number }) {
  const { data: session, update } = useSession();
  const user = session?.user as unknown as { name?: string | null; email?: string | null; role?: string } | undefined;
  const [adminOverride, setAdminOverride] = useState(false);
  // refresh JWT once after promotion so Админ appears without manual re-login
  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      // try to refresh session from server (jwt callback re-reads DB role)
      update();
      // fallback: direct admin check bypasses stale JWT
      fetch("/api/admin/stats").then((r) => {
        if (r.ok) setAdminOverride(true);
      }).catch(() => {});
    }
  }, [user?.email]);
  const isAdmin = user?.role === "ADMIN" || adminOverride;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const linkCls = (href: string) =>
    `px-3 py-1.5 sm:py-2 rounded-full text-[13px] sm:text-sm font-medium transition-colors min-h-[32px] sm:min-h-0 flex items-center justify-center ${pathname === href ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"}`;

  return (
    <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:bg-zinc-900/90 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-6 min-w-0">
          <Link href="/" className="text-[15px] sm:text-lg font-bold tracking-tight shrink-0">
            Lexlab <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs font-normal text-zinc-500">{total}</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            <Link href="/browse" className={linkCls("/browse")}>Бүх асуулт</Link>
            <Link href="/quiz" className={linkCls("/quiz")}>Шалгалт</Link>
            <Link href="/history" className={linkCls("/history")}>Түүх</Link>
            {isAdmin && <Link href="/admin" className={linkCls("/admin")}>Админ</Link>}
          </nav>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <span className="hidden lg:inline text-sm text-zinc-600 dark:text-zinc-400 max-w-[140px] truncate">{user.name || user.email}</span>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="hidden sm:inline-flex rounded-full border px-4 py-2.5 sm:py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 min-h-[40px] items-center">
                Гарах
              </button>
            </>
          ) : (
            <Link href="/login" className="hidden sm:inline-flex rounded-full bg-zinc-900 px-5 py-2.5 sm:py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 min-h-[40px] items-center">
              Нэвтрэх
            </Link>
          )}
          <button
            aria-label="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="sm:hidden inline-flex h-8 w-8 items-center justify-center rounded-full border dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <span className="text-[15px] leading-none">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>
      {open && (
        <div className="sm:hidden border-t bg-white dark:bg-zinc-900 dark:border-zinc-800 px-4 py-3 space-y-3">
          <div className={`grid gap-2 ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
            <Link href="/browse" onClick={() => setOpen(false)} className={linkCls("/browse")}>Бүх асуулт</Link>
            <Link href="/quiz" onClick={() => setOpen(false)} className={linkCls("/quiz")}>Шалгалт</Link>
            <Link href="/history" onClick={() => setOpen(false)} className={linkCls("/history")}>Түүх</Link>
            {isAdmin && <Link href="/admin" onClick={() => setOpen(false)} className={linkCls("/admin")}>Админ</Link>}
          </div>
          <div className="pt-2 border-t dark:border-zinc-800">
            {user ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate pr-2">{user.name || user.email}</span>
                <button onClick={() => signOut({ callbackUrl: "/" })} className="rounded-full border px-4 py-2.5 text-sm dark:border-zinc-700 min-h-[44px]">
                  Гарах
                </button>
              </div>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)} className="flex w-full justify-center rounded-full bg-zinc-900 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900 min-h-[44px] items-center">
                Нэвтрэх
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
