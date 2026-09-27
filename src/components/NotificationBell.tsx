"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type Ann = { id: string; body: string; createdAt: string; read: boolean };

export default function NotificationBell() {
  const { data: session, status } = useSession();
  const userId = (session?.user as unknown as { id?: string } | undefined)?.id;
  const pending = !userId && status === "loading";
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Ann[]>([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setUnread(0);
      setOpen(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/announcements", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        setItems(Array.isArray(d.announcements) ? d.announcements : []);
        setUnread(typeof d.unread === "number" ? d.unread : 0);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      fetch("/api/announcements/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => {});
      setUnread(0);
      setItems((prev) => prev.map((a) => ({ ...a, read: true })));
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Мэдэгдэл"
        title="Мэдэгдэл"
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
        <div className="absolute right-0 top-full z-50 mt-2 max-h-80 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#0b0b12] dark:shadow-black/50">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Мэдэгдэл алга</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((a) => (
                <li key={a.id} className="rounded-xl px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-white/5">
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-zinc-700 dark:text-zinc-200">{a.body}</p>
                  <p className="mt-1 text-[10px] text-zinc-400">{new Date(a.createdAt).toLocaleDateString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
