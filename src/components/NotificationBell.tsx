"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type Ann = { id: string; body: string; createdAt: string; read: boolean };

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "саяхан";
  if (mins < 60) return `${mins} мин өмнө`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} цаг өмнө`;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(new Date()) - day(new Date(iso))) / 86400000);
  if (days <= 1) return "өчигдөр";
  if (days < 30) return `${days} хоногийн өмнө`;
  return new Date(iso).toLocaleDateString("mn-MN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function NotificationBell() {
  const { data: session, status } = useSession();
  const userId = (session?.user as unknown as { id?: string } | undefined)?.id;
  const pending = !userId && status === "loading";
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Ann[]>([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/announcements", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setItems(Array.isArray(d.announcements) ? d.announcements : []);
      setUnread(typeof d.unread === "number" ? d.unread : 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setUnread(0);
      setOpen(false);
      return;
    }
    load();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60000);
    return () => clearInterval(poll);
  }, [userId, load]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (pending) {
    return <span aria-hidden className="inline-flex h-8 w-8 rounded-full border border-zinc-200 dark:border-white/15 invisible" />;
  }
  if (!userId) return null;

  const markAllRead = () => {
    setItems((prev) => prev.map((a) => ({ ...a, read: true })));
    setUnread(0);
    fetch("/api/announcements/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Мэдэгдэл"
        title="Мэдэгдэл"
        aria-haspopup="true"
        aria-expanded={open}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl motion-safe:animate-[bellIn_160ms_ease-out] dark:border-white/10 dark:bg-[#0b0b12] dark:shadow-black/50">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2.5 dark:border-white/5">
            <p className="flex items-center gap-2 text-[13px] font-semibold tracking-tight">
              Мэдэгдэл
              {unread > 0 && (
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  {unread} шинэ
                </span>
              )}
            </p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-300">
                Бүгдийг уншсан
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto overscroll-contain p-1.5">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-9 text-center">
                <svg viewBox="0 0 24 24" className="mb-1 h-7 w-7 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Мэдэгдэл одоогоор байхгүй байна</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {items.map((a) => (
                  <li
                    key={a.id}
                    className={`rounded-xl px-3 py-2.5 ${
                      a.read ? "hover:bg-zinc-50 dark:hover:bg-white/5" : "bg-indigo-50/70 hover:bg-indigo-50 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/15"
                    }`}
                  >
                    <div className="flex gap-2.5">
                      <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.read ? "" : "bg-indigo-500"}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`whitespace-pre-wrap break-words text-[13px] leading-snug ${a.read ? "text-zinc-600 dark:text-zinc-300" : "font-medium text-zinc-800 dark:text-zinc-100"}`}>
                          {a.body}
                        </p>
                        <p className="mt-1 text-[10.5px] text-zinc-400 dark:text-zinc-500">{timeAgo(a.createdAt)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
