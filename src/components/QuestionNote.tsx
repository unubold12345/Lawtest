"use client";
import { useEffect, useState } from "react";
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

  useEffect(() => { setHas(initialHas); }, [initialHas]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
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
    } catch {
      setErr("Сүлжээний алдаа");
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!confirm("Тэмдэглэлээ устгах уу?")) return;
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
    } catch {}
    setSaving(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setErr(""); if (isAuthed) load(); }}
        className="rounded-full border px-3 py-1 text-[11px] sm:text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        ✎ Тэмдэглэл{has ? " · ✓" : ""}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Миний тэмдэглэл">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl sm:p-5 dark:bg-zinc-900 dark:border dark:border-zinc-700">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm sm:text-base font-semibold">✎ Миний тэмдэглэл</p>
          <button onClick={() => setOpen(false)} aria-label="Хаах" className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-[13px] dark:border-zinc-700">✕</button>
        </div>
        {!isAuthed ? (
          <p className="mt-3 text-[13px] sm:text-sm text-zinc-500">
            Тэмдэглэхийн тулд <Link href="/login" className="underline font-medium text-zinc-900 dark:text-white">нэвтэрнэ үү</Link>.
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
              className="w-full rounded-xl border px-3 py-2 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700"
            />
            {err && <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400">{err}</p>}
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs text-zinc-400">{text.length}/2000</span>
              <div className="flex items-center gap-2">
                {has && (
                  <button
                    onClick={remove}
                    disabled={saving}
                    className="rounded-full px-4 py-2 text-[12px] sm:text-sm font-medium underline text-zinc-500 disabled:opacity-40 min-h-[36px]"
                  >
                    Устгах
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-full bg-zinc-900 px-5 py-2 text-[12px] sm:text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900 min-h-[36px]"
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
