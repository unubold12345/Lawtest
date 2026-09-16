"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Question } from "@/types/question";
import { fetchQuestionsByIds } from "@/lib/fetchQuestionsByIds";

type Attempt = {
  id: string;
  date: string;
  category: string;
  count: number;
  mode: string;
  score: number;
  total: number;
  elapsed: number;
  answers: Record<string, number>;
  questionIds: string[];
};

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const isAuthed = !!session?.user;
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [questionsById, setQuestionsById] = useState<Record<string, Question>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"review" | "all" | "correct">("review");
  const [openQ, setOpenQ] = useState<Record<string, boolean>>({});
  const [catFilter, setCatFilter] = useState<"all" | "main" | "sub" | "other">("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [openReview, setOpenReview] = useState<string | null>(null);
  const [pendingClearAll, setPendingClearAll] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Attempt | null>(null);

  const openAttempt = (id: string, isOpen: boolean) => {
    setExpanded(isOpen ? null : id);
    setReviewFilter("review");
    setOpenQ({});
  };

  const fileAnswer = (q: Question | undefined): number | undefined => {
    if (!q) return undefined;
    if (typeof q.answer === "number") return q.answer;
    if (Array.isArray(q.answer)) return (q.answer as number[])[0];
    return undefined;
  };

  const dotCls = (st: string) =>
    st === "correct" ? "bg-emerald-600 text-white" :
    st === "wrong" ? "bg-rose-600 text-white" :
    st === "unanswered" ? "bg-zinc-300 text-zinc-700 dark:bg-white/10 dark:text-zinc-200" :
    "bg-amber-400 text-white";
  const dotSym = (st: string) => (st === "correct" ? "✓" : st === "wrong" ? "✗" : st === "unanswered" ? "○" : "?");

  const fetchedIdsRef = useRef<Set<string>>(new Set());

  // fetch only the questions referenced by the shown attempts (chunked), never the whole bank
  useEffect(() => {
    const ids = [...new Set(attempts.flatMap((a) => a.questionIds || []))].filter(
      (id) => !fetchedIdsRef.current.has(id)
    );
    if (ids.length === 0) return;
    ids.forEach((id) => fetchedIdsRef.current.add(id));
    let cancel = false;
    fetchQuestionsByIds(ids).then((list) => {
      if (cancel || list.length === 0) return;
      const add: Record<string, Question> = {};
      list.forEach((q) => (add[q.id] = q));
      setQuestionsById((p) => ({ ...p, ...add }));
    });
    return () => {
      cancel = true;
    };
  }, [attempts]);

  useEffect(() => {
    if (status === "loading") return;
    if (isAuthed) {
      fetch("/api/attempts")
        .then((r) => (r.ok ? r.json() : { attempts: [] }))
        .then((d) => { setAttempts(d.attempts || []); })
        .catch(() => {
          const raw = localStorage.getItem("lawtest_attempts");
          if (raw) try { setAttempts(JSON.parse(raw)); } catch {}
        });
    } else {
      const raw = localStorage.getItem("lawtest_attempts");
      if (raw) try { setAttempts(JSON.parse(raw)); } catch {}
      else setAttempts([]);
    }
  }, [isAuthed, status]);

  const clear = async () => {
    if (isAuthed) {
      await fetch("/api/attempts", { method: "DELETE" });
      setAttempts([]);
    } else {
      localStorage.removeItem("lawtest_attempts");
      setAttempts([]);
    }
    setExpanded(null);
    setOpenReview(null);
    setOpenQ({});
  };

  const removeAttempt = async (a: Attempt) => {
    if (isAuthed) {
      await fetch(`/api/attempts?id=${encodeURIComponent(a.id)}`, { method: "DELETE" });
    } else {
      let arr: Attempt[] = [];
      const raw = localStorage.getItem("lawtest_attempts");
      if (raw) try { arr = JSON.parse(raw); } catch {}
      localStorage.setItem("lawtest_attempts", JSON.stringify(arr.filter((x) => x.id !== a.id)));
    }
    setAttempts((p) => p.filter((x) => x.id !== a.id));
    setPendingDelete(null);
    setExpanded(null);
    setOpenReview(null);
  };

  const letters = ["A", "B", "C", "D", "E"];
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const itemsOf = (a: Attempt) => {
    const items = (a.questionIds || []).map((qid, i) => {
      const q = questionsById[qid];
      const ans = a.answers?.[qid];
      const c = fileAnswer(q);
      const st = !q ? "missing" : c === undefined ? "unknown" : ans === undefined ? "unanswered" : ans === c ? "correct" : "wrong";
      return { qid, i, q, ans, c, st };
    });
    const nReview = items.filter((x) => x.st === "wrong" || x.st === "unanswered").length;
    const nOk = items.filter((x) => x.st === "correct").length;
    const eff = nReview > 0 ? reviewFilter : "all";
    const shown = items.filter((x) =>
      eff === "all" ? true : eff === "correct" ? x.st === "correct" : (x.st === "wrong" || x.st === "unanswered")
    );
    return { items, nReview, nOk, eff, shown };
  };

  // main-category names from the question pool — subcategory-section exams for "all subs" are labeled with the main name alone
  const mainCatSet = useMemo(() => new Set(Object.values(questionsById).map((q) => q.category).filter(Boolean)), [questionsById]);
  const catOf = (a: Attempt): "main" | "sub" | "other" =>
    a.category === "Үндсэн шалгалт" ? "main" : a.category.includes(" / ") || mainCatSet.has(a.category) ? "sub" : "other";
  const catCounts = { main: 0, sub: 0, other: 0 };
  attempts.forEach((a) => { catCounts[catOf(a)] += 1; });
  const shownAttempts = catFilter === "all" ? attempts : attempts.filter((a) => catOf(a) === catFilter);

  if (attempts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-2 sm:px-6 py-6 sm:py-10">
        <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:bg-white/[0.04] dark:border-white/10">
          Одоогоор шалгалт өгөөгүй. <Link href="/quiz" className="underline">Шалгалт эхлэх</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-2 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {([
            { k: "all", label: "Бүгд", n: attempts.length },
            { k: "main", label: "Үндсэн", n: catCounts.main },
            { k: "sub", label: "Дэд ангилал", n: catCounts.sub },
            { k: "other", label: "Бусад", n: catCounts.other },
          ] as const).map((c) => (
            <button
              key={c.k}
              onClick={() => { setCatFilter(c.k); setExpanded(null); }}
              aria-pressed={catFilter === c.k}
              className={`rounded-full border px-3 py-1.5 text-[11px] sm:text-xs font-medium min-h-[32px] sm:min-h-[36px] ${catFilter === c.k ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"}`}
            >
              {c.label} · {c.n}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="hidden sm:inline-flex items-center gap-0.5 rounded-full border border-zinc-200 bg-zinc-50 p-0.5 dark:border-white/15 dark:bg-white/5" role="group" aria-label="Харагдац">
            {([{ v: "list", label: "Жагсаалт" }, { v: "grid", label: "Сүлжээ" }] as const).map((o) => (
              <button
                key={o.v}
                onClick={() => setView(o.v)}
                aria-label={o.label}
                aria-pressed={view === o.v}
                title={o.label}
                className={`inline-flex h-8 w-11 items-center justify-center rounded-full transition-colors ${view === o.v ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-500 hover:bg-white hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"}`}
              >
                {o.v === "list" ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
                    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
                    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
                    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <button onClick={() => setPendingClearAll(true)} className="text-sm underline text-zinc-500 min-h-[44px] px-2">Цэвэрлэх</button>
        </div>
      </div>

      <div className={view === "grid" ? "mt-6 grid gap-4 sm:grid-cols-2 sm:items-start sm:grid-flow-row-dense" : "mt-6 grid gap-4"}>
        {shownAttempts.map((a) => {
          const isOpen = expanded === a.id;
          const pct = Math.round((a.score / a.total) * 100);
          return (
            <div key={a.id} className={`rounded-2xl border border-zinc-200 bg-white dark:bg-white/[0.04] dark:border-white/10 overflow-hidden${view === "grid" && isOpen ? " sm:col-span-2" : ""}`}>
              <button onClick={() => openAttempt(a.id, isOpen)} className="w-full p-3 sm:p-4 flex justify-between items-center text-left hover:bg-zinc-50 dark:hover:bg-white/5 gap-2 min-h-[56px]">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm sm:text-base">{a.score} / {a.total} · {pct}%</p>
                  <p className="text-xs text-zinc-500 break-words">{new Date(a.date).toLocaleString()} · {a.category} · {fmt(a.elapsed)} · {a.mode === "study" ? "Сургалт" : "Шалгалт"}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span className={`rounded-full px-2.5 sm:px-3 py-1 text-xs font-medium ${a.score / a.total >= 0.6 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"}`}>
                    {a.score / a.total >= 0.6 ? "Тэнцсэн" : "Унасан"}
                  </span>
                  <span className="text-sm text-zinc-400">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>

              {isOpen && (() => {
                const hasQs = !!a.questionIds && a.questionIds.length > 0;
                const { items, nOk } = itemsOf(a);
                return (
                  <div className="border-t border-zinc-200 p-3 sm:p-4 space-y-2 sm:space-y-3 bg-zinc-50 dark:bg-white/[0.02] dark:border-white/10">
                    {!hasQs && <p className="text-sm text-zinc-500">Дэлгэрэнгүй сорилго олдсонгүй (хуучин түүх).</p>}
                    {hasQs && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">✓ Зөв · {nOk}</span>
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">✗ Буруу · {items.filter((x) => x.st === "wrong").length}</span>
                        <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-zinc-700 dark:bg-white/5 dark:text-zinc-300">○ Хариулаагүй · {items.filter((x) => x.st === "unanswered").length}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {hasQs && (
                        <button onClick={() => setOpenReview(a.id)} className="flex-1 min-w-[160px] rounded-full bg-indigo-600 px-4 py-2.5 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px]">
                          Асуултуудыг үзэх ({items.length}) →
                        </button>
                      )}
                      <button onClick={() => setPendingDelete(a)} className="rounded-full border border-rose-200 px-4 py-2.5 text-[13px] sm:text-sm font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-300 dark:hover:bg-rose-400/10 min-h-[40px]">
                        Устгах
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
        {shownAttempts.length === 0 && (
          <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:bg-white/[0.04] dark:border-white/10 sm:col-span-2">
            Энэ шүүлтэд тохирох шалгалт олдсонгүй.
          </p>
        )}
      </div>

      {/* attempt review modal */}
      {openReview && (() => {
        const a = attempts.find((x) => x.id === openReview);
        if (!a) return null;
        const { items, nReview, nOk, eff, shown } = itemsOf(a);
        const allOpen = shown.length > 0 && shown.every((x) => x.q && openQ[x.qid]);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setOpenReview(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60" />
            <div className="relative w-full max-w-md sm:max-w-3xl max-h-[85vh] overflow-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c0c14]/95 dark:border dark:border-white/10 dark:backdrop-blur-xl">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-[14px] sm:text-base">{a.score} / {a.total} · {Math.round((a.score / a.total) * 100)}%</h3>
                  <p className="text-[11px] sm:text-xs text-zinc-500 break-words">{new Date(a.date).toLocaleString()} · {a.category} · {fmt(a.elapsed)} · {a.mode === "study" ? "Сургалт" : "Шалгалт"}</p>
                </div>
                <button onClick={() => setOpenReview(null)} aria-label="Хаах" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-[13px] text-zinc-500 dark:border-white/15">✕</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">✓ Зөв · {nOk}</span>
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">✗ Буруу · {items.filter((x) => x.st === "wrong").length}</span>
                <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-zinc-700 dark:bg-white/5 dark:text-zinc-300">○ Хариулаагүй · {items.filter((x) => x.st === "unanswered").length}</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto">
                {([
                  { k: "review", label: `Алдсан · ${nReview}` },
                  { k: "all", label: `Бүгд · ${items.length}` },
                  { k: "correct", label: `Зөв · ${nOk}` },
                ] as const).map((t) => (
                  <button
                    key={t.k}
                    onClick={() => setReviewFilter(t.k)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] sm:text-sm border min-h-[32px] ${eff === t.k ? "bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "bg-white border-zinc-200 hover:bg-zinc-50 dark:bg-white/[0.04] dark:border-white/15 dark:hover:bg-white/5"}`}
                  >
                    {t.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    if (allOpen) setOpenQ({});
                    else { const o: Record<string, boolean> = {}; shown.forEach((x) => { if (x.q) o[x.qid] = true; }); setOpenQ((p) => ({ ...p, ...o })); }
                  }}
                  className="shrink-0 ml-auto text-[11px] sm:text-xs underline text-zinc-500"
                >
                  {allOpen ? "Бүгдийг хураах" : "Бүгдийг нээх"}
                </button>
              </div>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2 sm:gap-2">
                {shown.map(({ qid, i, q, ans, c, st }) => {
                  if (!q) return <p key={qid} className="text-[12px] sm:text-sm text-zinc-500">{i + 1}. Сорилго {qid} олдсонгүй</p>;
                  const unknown = st === "unknown";
                  const ok = st === "correct";
                  const open = !!openQ[qid];
                  return (
                    <div key={qid} className={`rounded-xl sm:rounded-2xl border min-w-0 overflow-hidden ${unknown ? "bg-zinc-50 border-zinc-200 dark:bg-white/[0.04] dark:border-white/10" : ok ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-400/10 dark:border-emerald-400/30" : "bg-rose-50 border-rose-200 dark:bg-rose-400/10 dark:border-rose-400/30"}`}>
                      <button onClick={() => setOpenQ((p) => ({ ...p, [qid]: !p[qid] }))} className="w-full flex items-center gap-2 p-3 text-left min-w-0">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${dotCls(st)}`}>{dotSym(st)}</span>
                        <span className="text-zinc-400 text-[11px] shrink-0">{i + 1}.</span>
                        <span className={`flex-1 min-w-0 text-[13px] leading-snug break-words ${open ? "" : "line-clamp-2"}`}>{q.question}</span>
                        <span className="text-zinc-400 text-xs shrink-0">{open ? "▾" : "▸"}</span>
                      </button>
                      {open && (
                        <div className="px-3 pb-3">
                          <p className="text-[10px] text-zinc-500 break-words">{q.category}{q.subCategory ? ` · ${q.subCategory}` : ""} {unknown ? "· хариултгүй" : ""} {st === "unanswered" ? "· хариулаагүй" : ""}</p>
                          <div className="mt-2 grid gap-1.5 min-w-0">
                            {q.options.map((opt, oi) => (
                              <div
                                key={oi}
                                className={`rounded-lg border px-2.5 py-1.5 text-[12px] flex gap-1.5 min-w-0 overflow-hidden ${!unknown && oi === c ? "!border-emerald-500 !bg-emerald-50 dark:!bg-emerald-400/10" : ""} ${oi === ans && !ok && !unknown ? "!border-rose-500 !bg-rose-50 dark:!bg-rose-400/10" : "bg-white dark:bg-white/[0.04] dark:border-white/10"}`}
                              >
                                <span className="font-bold shrink-0">{letters[oi]}.</span>
                                <span className="flex-1 min-w-0 break-words leading-snug">{opt}</span>
                                {!unknown && oi === c && <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold shrink-0">✓</span>}
                                {oi === ans && oi !== c && !unknown && <span className="text-rose-700 dark:text-rose-400 text-xs shrink-0">← таны сонголт</span>}
                              </div>
                            ))}
                          </div>
                          {q.explanation && <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400">Тайлбар: {q.explanation}</p>}
                          {unknown && <p className="mt-1.5 text-[11px] text-zinc-500">Зөв хариулт хараахан тодорхойгүй.</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {shown.length === 0 && <p className="text-center py-6 text-[13px] text-zinc-500">Бүгд зөв — мундаг! 🎉</p>}
            </div>
          </div>
        );
      })()}

      {/* confirm delete one attempt */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="close" onClick={() => setPendingDelete(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60" />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-white/10 dark:bg-[#0c0c14]/95 dark:backdrop-blur-xl">
            <h3 className="font-semibold">Энэ шалгалтын түүхийг устгах уу?</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{pendingDelete.score} / {pendingDelete.total} · {new Date(pendingDelete.date).toLocaleString()} · {pendingDelete.category}</p>
            <p className="mt-2 text-[12px] sm:text-sm text-zinc-500">Устаж, буцаах боломжгүй болно.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPendingDelete(null)} className="rounded-full border border-zinc-200 px-5 py-2 text-[13px] sm:text-sm dark:border-white/15 min-h-[36px]">Цуцлах</button>
              <button onClick={() => removeAttempt(pendingDelete)} className="rounded-full bg-rose-600 px-5 py-2 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-rose-600/30 hover:bg-rose-500 dark:bg-gradient-to-r dark:from-rose-500 dark:to-rose-600 dark:text-white dark:shadow-lg dark:shadow-rose-950/40 dark:hover:from-rose-400 dark:hover:to-rose-500 min-h-[36px]">Устгах</button>
            </div>
          </div>
        </div>
      )}

      {/* confirm clear all */}
      {pendingClearAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="close" onClick={() => setPendingClearAll(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60" />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-white/10 dark:bg-[#0c0c14]/95 dark:backdrop-blur-xl">
            <h3 className="font-semibold">Бүх шалгалтын түүхийг устгах уу?</h3>
            <p className="mt-2 text-[12px] sm:text-sm text-zinc-500">{attempts.length} шалгалтын бүртгэл устаж, буцаах боломжгүй болно.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPendingClearAll(false)} className="rounded-full border border-zinc-200 px-5 py-2 text-[13px] sm:text-sm dark:border-white/15 min-h-[36px]">Цуцлах</button>
              <button onClick={() => { setPendingClearAll(false); clear(); }} className="rounded-full bg-rose-600 px-5 py-2 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-rose-600/30 hover:bg-rose-500 dark:bg-gradient-to-r dark:from-rose-500 dark:to-rose-600 dark:text-white dark:shadow-lg dark:shadow-rose-950/40 dark:hover:from-rose-400 dark:hover:to-rose-500 min-h-[36px]">Устгах</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
