"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import BrandMark from "@/components/BrandMark";
import { PlanLink } from "@/components/PlansProvider";

// The global bar is identical on the catalog, profile, and every exam edition.
// Study tools belong to the edition navigation below the selected exam title.
export default function Header() {
  const { data: session, status } = useSession();
  const user = session?.user as { name?: string | null; role?: string } | undefined;
  const displayName = user?.name && !/^[+\d]/.test(user.name.trim()) ? user.name : null;
  const pathname = usePathname();
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!userOpen) return;
    const onDown = (event: PointerEvent) => {
      if (!userRef.current?.contains(event.target as Node)) setUserOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setUserOpen(false); toggleRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [userOpen]);
  const menuCls = (href: string) => `flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${pathname === href ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"}`;
  return <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-white/10 dark:bg-[#07070c]/85">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:px-6 sm:py-3">
      <Link href="/" className="flex min-h-10 shrink-0 items-center gap-1.5" aria-label="Lexlab нүүр"><BrandMark /><span className="text-base font-extrabold tracking-tighter sm:text-lg">Lex<span className="font-medium text-zinc-500 dark:text-indigo-300">lab</span></span></Link>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <NotificationBell />
        {status === "loading" && !user ? <span aria-hidden className="h-10 w-10" /> : user ? <div ref={userRef} className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setUserOpen(false); }}>
          <button ref={toggleRef} type="button" aria-label="Профайл цэс" aria-expanded={userOpen} aria-controls="profile-dropdown" onClick={() => setUserOpen((value) => !value)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>
          </button>
          <div id="profile-dropdown" hidden={!userOpen} className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#0b0b12]">
            {displayName && <p className="truncate px-3 py-2 text-xs text-zinc-500">{displayName}</p>}
            <Link href="/profile" prefetch={false} onClick={() => setUserOpen(false)} className={menuCls("/profile")}>Профайл</Link>
            <PlanLink href="/plans" onClick={() => setUserOpen(false)} className={menuCls("/plans")}>Миний эрх</PlanLink>
            {user.role === "ADMIN" && <Link href="/admin" prefetch={false} onClick={() => setUserOpen(false)} className={menuCls("/admin")}>Админ</Link>}
            <button onClick={() => signOut({ callbackUrl: "/" })} className={menuCls("")}>Гарах</button>
          </div>
        </div> : <Link href="/login" className="inline-flex min-h-10 items-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500">Нэвтрэх</Link>}
      </div>
    </div>
  </header>;
}
