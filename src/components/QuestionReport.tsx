"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { lockScrollRoot } from "@/lib/scrollRoot";

const TYPES = [
  ["WRONG_ANSWER", "Зөв хариулт буруу"],
  ["WRONG_OPTIONS", "Сонголтууд буруу / дутуу"],
  ["QUESTION_ERROR", "Сорилгын текстэнд алдаа"],
  ["OTHER", "Бусад"],
] as const;

export default function QuestionReport({ questionId }: { questionId: string }) {
  const { data: session } = useSession();
  const isAuthed = !!session?.user;
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("WRONG_ANSWER");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const unlock = lockScrollRoot();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open]);

  const send = async () => {
    if (message.trim().length < 3 || sending) return;
    setSending(true);
    setErr("");
    try {
      const r = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, type, message: message.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Илгээж чадсангүй"); setSending(false); return; }
      setDone(true);
      setMessage("");
    } catch {
      setErr("Сүлжээний алдаа");
    }
    setSending(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setDone(false); setErr(""); }}
        className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] sm:text-xs font-medium hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5"
      >
        ⚑ Алдаа мэдээлэх
      </button>
    );
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Алдаа мэдээлэх">
        <div className="absolute inset-0 bg-black/60 dark:bg-black/70" onClick={() => setOpen(false)} />
        <div className="relative w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl sm:p-5 dark:border dark:border-white/10 dark:bg-[#0c0c14]/95 dark:backdrop-blur-xl">
          <p className="text-sm sm:text-base font-semibold text-emerald-600 dark:text-emerald-400">✓ Мэдээлэл админд илгээгдлээ — баярлалаа.</p>
          <button onClick={() => setOpen(false)} className="mt-3 rounded-full border border-zinc-200 px-5 py-2 text-[12px] sm:text-sm font-medium hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5 min-h-[36px]">Хаах</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Алдаа мэдээлэх">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/70" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl sm:p-5 dark:border dark:border-white/10 dark:bg-[#0c0c14]/95 dark:backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm sm:text-base font-semibold">⚑ Админд мэдээлэх</p>
          <button onClick={() => setOpen(false)} aria-label="Хаах" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-[13px] hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5">✕</button>
        </div>
        {!isAuthed ? (
          <p className="mt-3 text-[13px] sm:text-sm text-zinc-500">
            Мэдээлэхийн тулд <Link href="/login" className="underline font-medium text-zinc-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300">нэвтэрнэ үү</Link>.
          </p>
        ) : (
          <div className="mt-3 grid gap-2.5">
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setType(v)}
                  className={`rounded-full border px-3 py-2 text-[11px] sm:text-xs min-h-[36px] ${type === v ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Яг юу нь буруу вэ? (жишээ: зөв хариулт нь B байх ёстой…)"
              rows={4}
              maxLength={1000}
              autoFocus
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-[13px] sm:text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60"
            />
            {err && <p className="text-[11px] sm:text-xs text-rose-600 dark:text-rose-400">{err}</p>}
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs text-zinc-400">{message.length}/1000</span>
              <button
                onClick={send}
                disabled={sending || message.trim().length < 3}
                className="rounded-full bg-indigo-600 px-5 py-2 text-[12px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-40 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[36px]"
              >
                {sending ? "…" : "Илгээх"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
