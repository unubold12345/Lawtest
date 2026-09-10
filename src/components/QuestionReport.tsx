"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const TYPES = [
  ["WRONG_ANSWER", "Зөв хариулт буруу"],
  ["WRONG_OPTIONS", "Сонголтууд буруу / дутуу"],
  ["QUESTION_ERROR", "Асуултын текстэнд алдаа"],
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
        className="rounded-full border px-3 py-1 text-[11px] sm:text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        ⚑ Алдаа мэдээлэх
      </button>
    );
  }

  if (done) {
    return (
      <div className="rounded-lg border border-dashed p-2.5 sm:p-3 dark:border-zinc-700">
        <p className="text-[12px] sm:text-sm font-medium">✓ Мэдээлэл админд илгээгдлээ — баярлалаа.</p>
        <button onClick={() => setOpen(false)} className="mt-1 text-[11px] sm:text-xs underline text-zinc-500">Хаах</button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed p-2.5 sm:p-3 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] sm:text-sm font-medium">⚑ Админд мэдээлэх</p>
        <button onClick={() => setOpen(false)} aria-label="Хаах" className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-[12px] dark:border-zinc-700">✕</button>
      </div>
      {!isAuthed ? (
        <p className="mt-2 text-[12px] sm:text-sm text-zinc-500">
          Мэдээлэхийн тулд <Link href="/login" className="underline font-medium text-zinc-900 dark:text-white">нэвтэрнэ үү</Link>.
        </p>
      ) : (
        <div className="mt-2 grid gap-2">
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map(([v, label]) => (
              <button
                key={v}
                onClick={() => setType(v)}
                className={`rounded-full border px-3 py-1.5 text-[11px] sm:text-xs min-h-[32px] ${type === v ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Яг юу нь буруу вэ? (жишээ: зөв хариулт нь B байх ёстой…)"
            rows={2}
            maxLength={1000}
            className="w-full rounded-lg border px-3 py-2 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700"
          />
          {err && <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400">{err}</p>}
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] text-zinc-400">{message.length}/1000</span>
            <button
              onClick={send}
              disabled={sending || message.trim().length < 3}
              className="rounded-full bg-zinc-900 px-5 py-1.5 text-[12px] sm:text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900 min-h-[32px]"
            >
              {sending ? "…" : "Илгээх"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
