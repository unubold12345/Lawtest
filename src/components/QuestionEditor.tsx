"use client";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { fetchQuestionsByIds } from "@/lib/fetchQuestionsByIds";

export type EditableQuestion = {
  id: string;
  question: string;
  options: string[];
  answer?: number | number[] | null;
  explanation?: string;
  lawRef?: string;
  source?: string;
};

const editorInput = "w-full rounded-xl border border-zinc-200 px-3 py-2 text-[13px] sm:text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 disabled:opacity-50";
const editorPick = "border-transparent bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25";
const editorIdle = "border-zinc-200 dark:border-white/15";
const editorPrimary =
  "rounded-full bg-indigo-600 px-5 py-2.5 text-xs font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-40 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px]";
const editorGhost = "rounded-full border border-zinc-200 px-5 py-2.5 text-xs font-medium hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[40px]";

const optionLetter = (i: number) => String.fromCharCode(65 + i);

export function AutoGrowTextarea({ value, onChange, disabled, className }: { value: string; onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void; disabled?: boolean; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
    };
    let lastW = parent.clientWidth;
    const ro = new ResizeObserver(() => {
      if (parent.clientWidth === lastW) return;
      lastW = parent.clientWidth;
      fit();
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} onChange={onChange} disabled={disabled} className={`block resize-none overflow-hidden ${className || ""}`} />;
}

// Shared admin question editor. `initial` prefills the form (browse page already has the
// question loaded); without it the question is fetched by id (admin reports flow). When
// `report` is given, saving can also flip that report to RESOLVED.
export default function QuestionEditor({
  questionId,
  initial,
  report,
  onClose,
  onSaved,
}: {
  questionId: string;
  initial?: EditableQuestion | null;
  report?: { id: string; status: string } | null;
  onClose: () => void;
  onSaved: (updated: EditableQuestion, resolved: boolean) => void;
}) {
  const [q, setQ] = useState<EditableQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [answer, setAnswer] = useState<number | null>(null);
  const [explanation, setExplanation] = useState("");
  const [lawRef, setLawRef] = useState("");
  const [resolve, setResolve] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [resolvedOk, setResolvedOk] = useState(false);
  const [persisted, setPersisted] = useState("");
  const initialRef = useRef(initial ?? null);

  useEffect(() => {
    let alive = true;
    const apply = (one: EditableQuestion) => {
      setQ(one);
      setQuestion(one.question);
      setOptions(one.options);
      setAnswer(typeof one.answer === "number" ? one.answer : null);
      setExplanation(one.explanation || "");
      setLawRef(one.lawRef || "");
    };
    const seed = initialRef.current;
    if (seed) {
      apply(seed);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const found = await fetchQuestionsByIds([questionId]);
        if (!alive) return;
        const one = found[0] as EditableQuestion | undefined;
        if (!one) {
          setLoadErr("Сорилго олдсонгүй — id хуучирсан эсвэл файл устсан байна.");
          return;
        }
        apply(one);
      } catch {
        if (alive) setLoadErr("Ачаалж чадсангүй");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [questionId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const multi = Array.isArray(q?.answer);
  const isJson = !!q?.source?.toLowerCase().endsWith(".json");

  const save = async () => {
    if (!q || saving || !isJson || multi) return;
    const opts = options.map((o) => o.trim());
    if (!question.trim()) { setErr("Асуултын текст хоосон байна"); return; }
    if (opts.length < 2 || opts.length > 6 || opts.some((o) => !o)) { setErr("2–6 бөглөсөн сонголт байх ёстой"); return; }
    setSaving(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q.id, question: question.trim(), options: opts, answer, explanation: explanation.trim(), lawRef: lawRef.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Хадгалж чадсангүй"); setSaving(false); return; }
      setPersisted(typeof d.persisted === "string" ? d.persisted : "");
      let resolved = false;
      if (report && resolve && report.status === "OPEN") {
        try {
          const rr = await fetch(`/api/admin/reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "RESOLVED" }) });
          resolved = rr.ok;
        } catch { /* the edit is saved; report stays open */ }
      }
      setResolvedOk(resolved);
      setDone(true);
      onSaved({ id: q.id, question: question.trim(), options: opts, answer, explanation: explanation.trim(), lawRef: lawRef.trim(), source: q.source }, resolved);
    } catch {
      setErr("Сүлжээний алдаа");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Сорилго засах">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/70" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:border dark:border-white/10 dark:bg-[#0c0c14]/95 dark:backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-sm font-semibold sm:text-base">✎ Сорилго засах</p>
            <p className="truncate font-mono text-[10px] text-zinc-500">{q?.id ?? questionId}</p>
          </div>
          <button onClick={onClose} aria-label="Хаах" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-[13px] hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && <p className="py-8 text-center text-sm text-zinc-500">Ачаалж байна…</p>}
          {!loading && loadErr && <p className="py-6 text-center text-sm text-rose-600 dark:text-rose-400">{loadErr}</p>}

          {!loading && q && done && (
            <div className="py-6 text-center">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">✓ Хадгалагдлаа</p>
              {!!q.source && <p className="mt-1 break-all font-mono text-[10px] text-zinc-500">{q.source}</p>}
              <p className="mt-1 text-xs text-zinc-500">
                {persisted === "db"
                  ? "Сервер дээр хадгалагдлаа — бүх хэрэглэгчид шууд харагдана. (Энэ орчинд файлд бичих боломжгүй.)"
                  : "Сервер болон файлд хадгалагдлаа — бүх хэрэглэгчид шууд харагдана."}
              </p>
              {report && report.status === "OPEN" && (
                <p className="mt-1 text-xs text-zinc-500">{resolvedOk ? "Мэдээлэл «Шийдэгдсэн» боллоо." : "Мэдээллийн төлөвийг солиход алдаа гарлаа."}</p>
              )}
            </div>
          )}

          {!loading && q && !done && (
            <div className="grid gap-3">
              {!isJson && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                  Энэ сорилго JSON файлаас ачаалагдаагүй тул засах боломжгүй.
                </p>
              )}
              {multi && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                  Олон зөв хариулттай сорилгыг энэ хэлбэрээр засах боломжгүй.
                </p>
              )}
              <div>
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Асуулт</label>
                <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} disabled={!isJson || multi} className={`mt-1 ${editorInput}`} />
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Сонголтууд · зөв хариултыг тэмдэглэнэ үү</label>
                <div className="mt-1 grid gap-1.5">
                  {options.map((o, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <label className={`mt-0.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border text-xs font-semibold ${answer === i ? editorPick : editorIdle}`}>
                        <input type="radio" name="q-answer" className="sr-only" checked={answer === i} onChange={() => setAnswer(i)} disabled={!isJson || multi} />
                        {optionLetter(i)}
                      </label>
                      <AutoGrowTextarea value={o} onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} disabled={!isJson || multi} className={editorInput} />
                      {options.length > 2 && (
                        <button type="button" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))} aria-label="Сонголт устгах" disabled={!isJson || multi} className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-200 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-400/30 dark:text-rose-400 dark:hover:bg-rose-400/10">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {options.length < 6 && (
                    <button type="button" onClick={() => setOptions((p) => [...p, ""])} disabled={!isJson || multi} className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-[11px] hover:bg-zinc-50 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/5">+ Сонголт нэмэх</button>
                  )}
                  {answer !== null && (
                    <button type="button" onClick={() => setAnswer(null)} disabled={!isJson || multi} className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-[11px] hover:bg-zinc-50 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/5">Зөв хариултыг арилгах</button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Тайлбар (заавал биш)</label>
                <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} disabled={!isJson || multi} className={`mt-1 ${editorInput}`} />
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Хуулийн холбоос / лавлагаа (заавал биш)</label>
                <input value={lawRef} onChange={(e) => setLawRef(e.target.value)} disabled={!isJson || multi} className={`mt-1 ${editorInput}`} />
              </div>
              {report && (
                <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" checked={resolve} onChange={(e) => setResolve(e.target.checked)} className="h-4 w-4" />
                  Хадгалсны дараа мэдээллийг «Шийдэгдсэн» болгох
                </label>
              )}
              {err && <p className="text-xs text-rose-600 dark:text-rose-400">{err}</p>}
              {!!q.source && <p className="break-all font-mono text-[10px] text-zinc-400 dark:text-zinc-500">📄 {q.source}</p>}
            </div>
          )}
        </div>

        {!loading && q && (
          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-white/10">
            {done ? (
              <button onClick={onClose} className={editorPrimary}>Хаах</button>
            ) : (
              <>
                <button onClick={onClose} className={editorGhost}>Болих</button>
                <button onClick={save} disabled={saving || !isJson || multi} className={editorPrimary}>
                  {saving ? "Хадгалж байна…" : "Хадгалах"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
