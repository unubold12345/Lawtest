"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Question } from "@/types/question";

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
    st === "correct" ? "bg-green-600 text-white" :
    st === "wrong" ? "bg-red-600 text-white" :
    st === "unanswered" ? "bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" :
    "bg-amber-400 text-white";
  const dotSym = (st: string) => (st === "correct" ? "✓" : st === "wrong" ? "✗" : st === "unanswered" ? "○" : "?");

  useEffect(() => {
    // fetch full questions for detail rendering
    fetch("/api/questions?full=1")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, Question> = {};
        (d.questions as Question[]).forEach((q) => (map[q.id] = q));
        setQuestionsById(map);
      })
      .catch(() => {});
  }, []);

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
  };

  const letters = ["A", "B", "C", "D", "E"];
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (attempts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
        <h1 className="text-xl sm:text-2xl font-semibold">Түүх</h1>
        <p className="mt-4 rounded-xl border bg-white p-6 text-sm text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800">
          Одоогоор шалгалт өгөөгүй. <Link href="/quiz" className="underline">Шалгалт эхлэх</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-semibold">Түүх — {attempts.length}</h1>
        <button onClick={clear} className="text-sm underline text-zinc-500 min-h-[44px] px-2">Цэвэрлэх</button>
      </div>

      <div className="mt-6 grid gap-4">
        {attempts.map((a) => {
          const isOpen = expanded === a.id;
          const pct = Math.round((a.score / a.total) * 100);
          return (
            <div key={a.id} className="rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden">
              <button onClick={() => openAttempt(a.id, isOpen)} className="w-full p-3 sm:p-4 flex justify-between items-center text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 gap-2 min-h-[56px]">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm sm:text-base">{a.score} / {a.total} · {pct}%</p>
                  <p className="text-xs text-zinc-500 break-words">{new Date(a.date).toLocaleString()} · {a.category} · {fmt(a.elapsed)} · {a.mode === "study" ? "Сургалт" : "Шалгалт"}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span className={`rounded-full px-2.5 sm:px-3 py-1 text-xs font-medium ${a.score / a.total >= 0.6 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {a.score / a.total >= 0.6 ? "Тэнцсэн" : "Унасан"}
                  </span>
                  <span className="text-sm text-zinc-400">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>

              {isOpen && (() => {
                if (!a.questionIds || a.questionIds.length === 0) {
                  return (
                    <div className="border-t p-4 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
                      <p className="text-sm text-zinc-500">Дэлгэрэнгүй асуулт олдсонгүй (хуучин түүх).</p>
                    </div>
                  );
                }
                const items = a.questionIds.map((qid, i) => {
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
                const allOpen = shown.length > 0 && shown.every((x) => x.q && openQ[x.qid]);
                return (
                  <div className="border-t p-3 sm:p-4 space-y-2 sm:space-y-3 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
                    {/* stat chips */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200">✓ Зөв · {nOk}</span>
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">✗ Буруу · {items.filter((x) => x.st === "wrong").length}</span>
                      <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">○ Хариулаагүй · {items.filter((x) => x.st === "unanswered").length}</span>
                    </div>
                    {/* filter tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {([
                        { k: "review", label: `Алдсан · ${nReview}` },
                        { k: "all", label: `Бүгд · ${items.length}` },
                        { k: "correct", label: `Зөв · ${nOk}` },
                      ] as const).map((t) => (
                        <button
                          key={t.k}
                          onClick={() => setReviewFilter(t.k)}
                          className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] sm:text-sm border min-h-[32px] ${eff === t.k ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700"}`}
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
                    {shown.map(({ qid, i, q, ans, c, st }) => {
                      if (!q) return <p key={qid} className="text-[12px] sm:text-sm text-zinc-500">{i + 1}. Асуулт {qid} олдсонгүй</p>;
                      const unknown = st === "unknown";
                      const ok = st === "correct";
                      const open = !!openQ[qid];
                      return (
                        <div key={qid} className={`rounded-xl sm:rounded-2xl border min-w-0 overflow-hidden ${unknown ? "bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800" : ok ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"} dark:bg-zinc-900`}>
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
                                    className={`rounded-lg border px-2.5 py-1.5 text-[12px] flex gap-1.5 min-w-0 overflow-hidden ${!unknown && oi === c ? "border-green-500 bg-green-100 dark:bg-green-900/50" : ""} ${oi === ans && !ok && !unknown ? "border-red-500 bg-red-100 dark:bg-red-900/50" : "bg-white dark:bg-zinc-800 dark:border-zinc-700"}`}
                                  >
                                    <span className="font-bold shrink-0">{letters[oi]}.</span>
                                    <span className="flex-1 min-w-0 break-words leading-snug">{opt}</span>
                                    {!unknown && oi === c && <span className="text-green-700 dark:text-green-300 text-xs font-bold shrink-0">✓</span>}
                                    {oi === ans && oi !== c && !unknown && <span className="text-red-700 dark:text-red-300 text-xs shrink-0">← таны сонголт</span>}
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
                    {shown.length === 0 && <p className="text-center py-6 text-[13px] text-zinc-500">Бүгд зөв — мундаг! 🎉</p>}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
