"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import BrandMark from "@/components/BrandMark";

export default function Header() {
  const { data: session, status, update } = useSession();
  const user = session?.user as unknown as { name?: string | null; email?: string | null; role?: string; hasPaid?: boolean } | undefined;
  // show auto display name (user01, ...) — never a phone number (legacy names stay hidden)
  const displayName = user?.name && !/^[+\d]/.test(user.name.trim()) ? user.name : null;
  // refresh JWT once after promotion so Админ appears without manual re-login
  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      // jwt callback re-reads the DB role, so a session update is enough
      update();
    }
  }, [user?.email]);
  const isAdmin = user?.role === "ADMIN";
  // session not resolved yet — show invisible placeholders instead of flashing guest UI
  const authPending = !user && status === "loading";
  const pathname = usePathname();
  const browseActive = pathname === "/browse" || pathname === "/browse/unanswered" || pathname === "/v2";
  const [open, setOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [mobileBrowse, setMobileBrowse] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement | null>(null);
  // close the avatar dropdown on outside click / Escape
  useEffect(() => {
    if (!userOpen) return;
    const onDown = (e: PointerEvent) => { if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setUserOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [userOpen ]);
  // lock body scroll + Escape closes the mobile drawer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open ]);
  useEffect(() => {
    if (open) setMobileBrowse(browseActive);
  }, [open, browseActive]);
  const linkCls = (href: string, active?: boolean) =>
    `px-3 py-1.5 sm:py-2 rounded-full text-[13px] sm:text-sm font-medium transition-colors min-h-[32px] sm:min-h-0 flex items-center justify-center ${(active ?? pathname === href) ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 dark:bg-indigo-500/15 dark:text-indigo-200 dark:shadow-none dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"}`;
  const menuCls = (href: string) =>
    `flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${pathname === href ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-zinc-100"}`;
  const mobileRowCls = (active: boolean, sub?: boolean) =>
    `flex items-center ${sub ? "pl-6 pr-4 min-h-[40px] text-[13px]" : "px-4 min-h-[44px] text-[14px]"} rounded-xl font-medium transition-colors ${active ? "bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-zinc-100"}`;

  return (
    <>
    <header className="z-30 border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 sm:sticky sm:top-0 pt-[env(safe-area-inset-top)] dark:border-white/10 dark:bg-[#07070c]/75 dark:supports-[backdrop-filter]:bg-[#07070c]/65">
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
            <div
              className="relative"
              onMouseEnter={() => setBrowseOpen(true)}
              onMouseLeave={() => setBrowseOpen(false)}
              onFocus={() => setBrowseOpen(true)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setBrowseOpen(false); }}
            >
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={browseOpen}
                className={`${linkCls("/browse", browseActive)} gap-1`}
              >
                Сорилго
                <span className="text-[9px] opacity-70" aria-hidden>▼</span>
              </button>
              <div className={`absolute left-0 top-full z-40 pt-2 transition-opacity ${browseOpen ? "visible opacity-100" : "invisible opacity-0"}`}>
                <div className="w-52 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#0b0b12]">
                  <Link href="/browse" prefetch={false} onClick={() => setBrowseOpen(false)} className={menuCls("/browse")}>Хариулттай сорилго</Link>
                  <Link href="/browse/unanswered" prefetch={false} onClick={() => setBrowseOpen(false)} className={menuCls("/browse/unanswered")}>Хариултгүй сорилго</Link>
                  <Link href="/v2" prefetch={false} onClick={() => setBrowseOpen(false)} className={menuCls("/v2")}>v2(beta)</Link>
                </div>
              </div>
            </div>
            <Link href="/quiz" prefetch={false} className={linkCls("/quiz")}>Шалгалт</Link>
            <Link href="/history" prefetch={false} className={linkCls("/history")}>Түүх</Link>
            <Link href="/calendar" prefetch={false} className={linkCls("/calendar")}>Календар</Link>
            {!authPending && user?.hasPaid !== true && <Link href="/plan" prefetch={false} className={linkCls("/plan")}>Эрх авах</Link>}
            {user && isAdmin && <Link href="/admin" prefetch={false} className={linkCls("/admin")}>Админ</Link>}
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
          <NotificationBell />
          {authPending ? (
            <span aria-hidden className="hidden sm:inline-flex items-center rounded-full px-5 py-2.5 sm:py-2 text-sm font-medium min-h-[40px] invisible">
              Нэвтрэх
            </span>
          ) : user ? (
            <div ref={userRef} className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={userOpen}
                aria-label="Профайл цэс"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${pathname === "/profile" ? "border-indigo-500 ring-1 ring-inset ring-indigo-500 text-indigo-600 dark:border-indigo-400 dark:ring-indigo-400 dark:text-indigo-300" : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"}`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
                </svg>
              </button>
              <div className={`absolute right-0 top-full z-40 pt-2 transition-opacity ${userOpen ? "visible opacity-100" : "invisible opacity-0"}`}>
                <div className="w-52 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#0b0b12]" role="menu">
                  {displayName && (
                    <p className="truncate px-3 py-2 text-[12px] text-zinc-500 dark:text-zinc-400">{displayName}</p>
                  )}
                  <Link href="/profile" prefetch={false} onClick={() => setUserOpen(false)} className={menuCls("/profile")} role="menuitem">Профайл</Link>
                  <button onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full items-center px-3 py-2 rounded-lg text-[13px] font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5" role="menuitem">
                    Гарах
                  </button>
                </div>
              </div>
            </div>
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
        className={`sm:hidden fixed left-0 top-0 bottom-0 z-50 w-[270px] max-w-[80vw] bg-white dark:bg-[#0b0b12] shadow-2xl dark:shadow-black/60 dark:border-r dark:border-white/10 transition-transform duration-200 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${open ? "translate-x-0" : "-translate-x-full"}`}
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
          <Link href="/" onClick={() => setOpen(false)} className={mobileRowCls(pathname === "/")}>
            Нүүр
          </Link>
          <div>
            <button
              type="button"
              aria-expanded={mobileBrowse}
              aria-controls="mobile-browse-menu"
              onClick={() => setMobileBrowse((v) => !v)}
              className={`${mobileRowCls(browseActive)} w-full justify-between`}
            >
              <span>Сорилго</span>
              <span className={`text-[10px] opacity-70 transition-transform ${mobileBrowse ? "rotate-180" : ""}`} aria-hidden>▼</span>
            </button>
            {mobileBrowse && (
              <div id="mobile-browse-menu" className="mt-1 space-y-1 pl-3">
                <Link href="/browse" onClick={() => setOpen(false)} className={mobileRowCls(pathname === "/browse", true)}>
                  Хариулттай сорилго
                </Link>
                <Link href="/browse/unanswered" onClick={() => setOpen(false)} className={mobileRowCls(pathname === "/browse/unanswered", true)}>
                  Хариултгүй сорилго
                </Link>
                <Link href="/v2" onClick={() => setOpen(false)} className={mobileRowCls(pathname === "/v2", true)}>
                  v2(beta)
                </Link>
              </div>
            )}
          </div>
          {[
            { href: "/quiz", label: "Шалгалт" },
            { href: "/history", label: "Түүх" },
            { href: "/calendar", label: "Календар" },
            ...(!authPending && user?.hasPaid !== true ? [{ href: "/plan", label: "Эрх авах" }] : []),
            ...(user && isAdmin ? [{ href: "/admin", label: "Админ" }] : []),
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={mobileRowCls(pathname === l.href)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-4 border-t border-zinc-200/80 dark:border-white/10">
          {authPending ? (
            <span aria-hidden className="flex w-full justify-center rounded-full py-3 text-sm font-medium min-h-[44px] items-center invisible">
              Нэвтрэх
            </span>
          ) : user ? (
            <div className="space-y-2">
              <Link href="/profile" onClick={() => setOpen(false)} aria-current={pathname === "/profile" ? "page" : undefined} className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium min-h-[44px] ${pathname === "/profile" ? "border-indigo-500 ring-1 ring-inset ring-indigo-500 text-indigo-700 dark:border-indigo-400 dark:ring-indigo-400 dark:text-indigo-200" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5"}`}>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
                  </svg>
                </span>
                <span className="min-w-0 truncate">{displayName ?? "Профайл"}</span>
              </Link>
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
