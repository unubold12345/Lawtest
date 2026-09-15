"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import BrandMark from "@/components/BrandMark";

export default function Header() {
  const { data: session, update } = useSession();
  const user = session?.user as unknown as { name?: string | null; email?: string | null; role?: string; hasPaid?: boolean } | undefined;
  // show auto display name (user01, ...) — never a phone number (legacy names stay hidden)
  const displayName = user?.name && !/^[+\d]/.test(user.name.trim()) ? user.name : null;
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
  // lock body scroll + Escape closes the mobile drawer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open ]);
  const linkCls = (href: string) =>
    `px-3 py-1.5 sm:py-2 rounded-full text-[13px] sm:text-sm font-medium transition-colors min-h-[32px] sm:min-h-0 flex items-center justify-center ${pathname === href ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 dark:bg-indigo-500/15 dark:text-indigo-200 dark:shadow-none dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"}`;

  return (
    <>
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 dark:border-white/10 dark:bg-[#07070c]/75 dark:supports-[backdrop-filter]:bg-[#07070c]/65">
      <div className="relative mx-auto max-w-6xl px-2 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-6 min-w-0">
          <button
            aria-label="menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 dark:border-white/15 dark:hover:bg-white/5"
          >
            <span className="text-[15px] leading-none">☰</span>
          </button>
          <Link href="/" className="hidden sm:flex items-center gap-1.5 shrink-0" aria-label="Lexlab нүүр">
            <BrandMark />
            <span className="text-[15px] sm:text-lg font-extrabold tracking-tighter">
              Lex<span className="font-medium text-zinc-500 dark:text-indigo-300">lab</span>
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            <Link href="/browse" className={linkCls("/browse")}>Бүх сорилго</Link>
            <Link href="/quiz" className={linkCls("/quiz")}>Шалгалт</Link>
            <Link href="/history" className={linkCls("/history")}>Түүх</Link>
            <Link href="/calendar" className={linkCls("/calendar")}>Календар</Link>
            {user?.hasPaid !== true && <Link href="/plan" className={linkCls("/plan")}>Эрх авах</Link>}
            {isAdmin && <Link href="/admin" className={linkCls("/admin")}>Админ</Link>}
          </nav>
        </div>
        <Link href="/" className="sm:hidden absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5" aria-label="Lexlab нүүр">
          <BrandMark />
          <span className="text-[15px] font-extrabold tracking-tighter">
            Lex<span className="font-medium text-zinc-500 dark:text-indigo-300">lab</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          {user ? (
            <>
              {displayName && <span className="hidden lg:inline text-sm text-zinc-600 dark:text-zinc-400 max-w-[140px] truncate">{displayName}</span>}
              <button onClick={() => signOut({ callbackUrl: "/" })} className="hidden sm:inline-flex rounded-full border border-zinc-200 px-4 py-2.5 sm:py-2 text-sm hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[40px] items-center">
                Гарах
              </button>
            </>
          ) : (
            <Link href="/login" className="hidden sm:inline-flex rounded-full bg-indigo-600 px-5 py-2.5 sm:py-2 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px] items-center">
              Нэвтрэх
            </Link>
          )}
        </div>
      </div>
    </header>
      {/* mobile slide-in drawer (outside <header>: its backdrop-blur traps position:fixed) */}
      <div
        className={`sm:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />
      <aside
        className={`sm:hidden fixed left-0 top-0 bottom-0 z-50 w-[270px] max-w-[80vw] bg-white dark:bg-[#0b0b12] shadow-2xl dark:shadow-black/60 dark:border-r dark:border-white/10 transition-transform duration-200 flex flex-col ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200/80 dark:border-white/10">
          <span className="flex items-center gap-1.5 font-extrabold tracking-tighter">
            <BrandMark />
            Lex<span className="font-medium text-zinc-500 dark:text-indigo-300">lab</span>
          </span>
          <button
            aria-label="close menu"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 dark:border-white/15 dark:hover:bg-white/5"
          >
            <span className="text-[15px] leading-none">✕</span>
          </button>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto">
          {[
            { href: "/", label: "Нүүр" },
            { href: "/browse", label: "Бүх сорилго" },
            { href: "/quiz", label: "Шалгалт" },
            { href: "/history", label: "Түүх" },
            { href: "/calendar", label: "Календар" },
            ...(user?.hasPaid === true ? [] : [{ href: "/plan", label: "Эрх авах" }]),
            ...(isAdmin ? [{ href: "/admin", label: "Админ" }] : []),
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`flex items-center px-4 min-h-[44px] rounded-xl text-[14px] font-medium transition-colors ${pathname === l.href ? "bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-zinc-100"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-4 border-t border-zinc-200/80 dark:border-white/10">
          {user ? (
            <div className="space-y-2">
              {displayName && <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{displayName}</p>}
              <button onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full justify-center rounded-full border border-zinc-200 px-4 py-2.5 text-sm dark:border-white/15 dark:hover:bg-white/5 min-h-[44px] items-center">
                Гарах
              </button>
            </div>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)} className="flex w-full justify-center rounded-full bg-indigo-600 py-3 text-sm font-medium text-white hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[44px] items-center">
              Нэвтрэх
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
