"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function QuestionNote({
  questionId,
  initialHas,
  onChange,
}: {
  questionId: string;
  initialHas: boolean;
  onChange: (id: string, has: boolean) => void;
}) {
  const { data: session } = useSession();
  const isAuthed = !!session?.user;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [has, setHas] = useState(initialHas);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [flashMsg, setFlashMsg] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => { setHas(initialHas); }, [initialHas]);

  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);

  const showFlash = (m: string) => {
    setFlashMsg(m);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashMsg(""), 1800);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setConfirmRemove(false); } };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const load = async () => {
    if (loaded) return;
    try {
      const r = await fetch(`/api/notes?ids=${encodeURIComponent(questionId)}`);
      const d = await r.json();
      if (d.notes?.[questionId]) {
        setText(d.notes[questionId].content);
        setHas(true);
      }
    } catch {}
    setLoaded(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErr("");
    try {
      const r = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, content: text.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Хадгалж чадсангүй"); setSaving(false); return; }
      const nowHas = !d.deleted;
      setHas(nowHas);
      onChange(questionId, nowHas);
      setConfirmRemove(false);
      showFlash(nowHas ? "Хадгалагдлаа" : "Устгагдлаа");
    } catch {
      setErr("Сүлжээний алдаа");
    }
    setSaving(false);
  };

  const remove = async () => {
    setText("");
    setSaving(true);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, content: "" }),
      });
      setHas(false);
      onChange(questionId, false);
      setConfirmRemove(false);
      showFlash("Устгагдлаа");
    } catch {}
    setSaving(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setErr(""); setFlashMsg(""); setConfirmRemove(false); if (isAuthed) load(); }}
        className={`rounded-full border px-3 py-1.5 text-[11px] sm:text-xs font-medium min-h-[36px] ${has ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20" : "border-zinc-200 hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5"}`}
      >
        ✎ Тэмдэглэл{has ? " · ✓" : ""}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Миний тэмдэглэл">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/70" onClick={() => { setOpen(false); setConfirmRemove(false); }} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl sm:p-5 dark:border dark:border-white/10 dark:bg-[#0c0c14]/95 dark:backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm sm:text-base font-semibold">✎ Миний тэмдэглэл</p>
          <button onClick={() => { setOpen(false); setConfirmRemove(false); }} aria-label="Хаах" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-[13px] hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5">✕</button>
        </div>
        {!isAuthed ? (
          <p className="mt-3 text-[13px] sm:text-sm text-zinc-500">
            Тэмдэглэхийн тулд <Link href="/login" className="underline font-medium text-zinc-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300">нэвтэрнэ үү</Link>.
          </p>
        ) : (
          <div className="mt-3 grid gap-2.5">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Энэ сорилгод зориулж өөртөө сануулах зүйл бичнэ үү… (зөвхөн танд харагдана)"
              rows={4}
              maxLength={2000}
              autoFocus
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-[13px] sm:text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60"
            />
            {err && <p className="text-[11px] sm:text-xs text-rose-600 dark:text-rose-400">{err}</p>}
            {flashMsg && <p className="text-[11px] sm:text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ {flashMsg}</p>}
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs text-zinc-400">{text.length}/2000</span>
              <div className="flex items-center gap-2">
                {has && (
                  confirmRemove ? (
                    <button
                      onClick={remove}
                      disabled={saving}
                      className="rounded-full bg-rose-600 px-4 py-2 text-[12px] sm:text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-40 min-h-[36px]"
                    >
                      Устгах уу?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(true)}
                      disabled={saving}
                      className="rounded-full border border-rose-200 px-4 py-2 text-[12px] sm:text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-400/30 dark:text-rose-400 dark:hover:bg-rose-500/10 min-h-[36px]"
                    >
                      Устгах
                    </button>
                  )
                )}
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-full bg-indigo-600 px-5 py-2 text-[12px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-40 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[36px]"
                >
                  {saving ? "…" : "Хадгалах"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
