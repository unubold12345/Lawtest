"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { Question } from "@/types/question";
import { effectiveAnswer, getAllOverrides } from "@/lib/answerOverrides";

type Mode = "exam" | "study";
type QuizState = "setup" | "running" | "result";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function saveLocal(attempt: object) {
  const raw = localStorage.getItem("lawtest_attempts");
  const arr = raw ? JSON.parse(raw) : [];
  arr.unshift(attempt);
  localStorage.setItem("lawtest_attempts", JSON.stringify(arr.slice(0, 50)));
}

async function saveAttempt(payload: { category: string; mode: string; score: number; total: number; elapsed: number; answers: Record<string, number>; questionIds: string[] }, isAuthed: boolean) {
  const localAttempt = { id: Date.now().toString(), date: new Date().toISOString(), category: payload.category, count: payload.total, mode: payload.mode, score: payload.score, total: payload.total, elapsed: payload.elapsed, answers: payload.answers, questionIds: payload.questionIds };
  if (isAuthed) {
    try {
      const r = await fetch("/api/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) saveLocal(localAttempt);
    } catch { saveLocal(localAttempt); }
  } else {
    saveLocal(localAttempt);
  }
}

export default function QuizClient({ questions }: { questions: Question[] }) {
  const { data: session } = useSession();
  const isAuthed = !!session?.user;
  const collator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }), []);
  const mainCategories = useMemo(() => ([...new Set(questions.map((x) => x.category).filter(Boolean))] as string[]).sort((a, b) => collator.compare(a, b)), [questions, collator]);
  const [mainCategory, setMainCategory] = useState<string>("all");
  const [subCategory, setSubCategory] = useState<string>("all");
  const subCategories = useMemo(() => {
    let pool: typeof questions = questions;
    if (mainCategory !== "all") pool = pool.filter((x) => x.category === mainCategory);
    return ([...new Set(pool.map((x) => x.subCategory).filter(Boolean))] as string[]).sort((a, b) => collator.compare(a, b));
  }, [questions, mainCategory, collator]);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  useEffect(() => {
    setOverrides(getAllOverrides());
    const h = () => setOverrides(getAllOverrides());
    window.addEventListener("lawtest:overrides", h as EventListener);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("lawtest:overrides", h as EventListener); window.removeEventListener("storage", h); };
  }, []);

  const [state, setState] = useState<QuizState>("setup");
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<Mode>("exam");
  const [minutes, setMinutes] = useState(20);

  const [quizQs, setQuizQs] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showStudyFeedback, setShowStudyFeedback] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const [elapsed, setElapsed] = useState(0);

  const start = () => {
    let pool = questions;
    if (mainCategory !== "all") pool = pool.filter((q) => q.category === mainCategory);
    if (subCategory !== "all") pool = pool.filter((q) => q.subCategory === subCategory);
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
    setQuizQs(picked);
    setAnswers({});
    setIdx(0);
    setTimeLeft(minutes * 60);
    setElapsed(0);
    setShowStudyFeedback(false);
    setState("running");
  };

  // timer
  useEffect(() => {
    if (state !== "running") return;
    if (minutes === 0) return; // no timer
    if (timeLeft <= 0) {
      const s = quizQs.reduce((acc, q) => {
        const a = answers[q.id];
        const c = effectiveAnswer(q, overrides);
        if (c === null) return acc;
        return acc + (a === c ? 1 : 0);
      }, 0);
      const catLabel = mainCategory === "all" ? "all" : subCategory !== "all" ? `${mainCategory} / ${subCategory}` : mainCategory;
      saveAttempt({ category: catLabel, mode, score: s, total: quizQs.length, elapsed: minutes * 60, answers, questionIds: quizQs.map((q) => q.id) }, isAuthed);
      setState("result");
      return;
    }
    const id = setInterval(() => { setTimeLeft((t) => t - 1); setElapsed((e) => e + 1); }, 1000);
    return () => clearInterval(id);
  }, [state, timeLeft, minutes, quizQs, answers, mainCategory, subCategory, mode, isAuthed]);

  // also count elapsed when no timer
  useEffect(() => {
    if (state !== "running" || minutes !== 0) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [state, minutes]);

  const current = quizQs[idx];
  const total = quizQs.length;

  const score = useMemo(() => {
    let s = 0;
    quizQs.forEach((q) => {
      const a = answers[q.id];
      const correct = effectiveAnswer(q, overrides);
      if (correct !== null && a === correct) s++;
    });
    return s;
  }, [quizQs, answers, overrides]);

  const submit = () => {
    const catLabel = mainCategory === "all" ? "all" : subCategory !== "all" ? `${mainCategory} / ${subCategory}` : mainCategory;
    saveAttempt({ category: catLabel, mode, score, total, elapsed: minutes === 0 ? elapsed : minutes * 60 - timeLeft, answers, questionIds: quizQs.map((q) => q.id) }, isAuthed);
    setState("result");
  };

  const letters = ["A", "B", "C", "D", "E"];
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (state === "setup") {
    const pool = (() => {
      let out = questions;
      if (mainCategory !== "all") out = out.filter((x) => x.category === mainCategory);
      if (subCategory !== "all") out = out.filter((x) => x.subCategory === subCategory);
      return out;
    })();
    const poolSize = pool.length;
    return (
      <div className="mx-auto max-w-3xl w-full rounded-xl sm:rounded-2xl border bg-white p-4 sm:p-8 dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden">
        <h1 className="text-[16px] sm:text-2xl font-semibold break-words">Шалгалт тохиргоо</h1>
        <p className="mt-1 text-[11px] sm:text-sm text-zinc-500 break-words [overflow-wrap:anywhere] leading-snug">{questions.length} асуулт бэлэн · {mainCategories.join(", ")} {subCategories.length ? `· ${subCategories.join(", ")}` : ""}</p>

        <div className="mt-4 sm:mt-8 grid gap-4 sm:gap-6 min-w-0">
          <label className="grid gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[12px] sm:text-sm font-medium">Үндсэн ангилал</span>
            <select value={mainCategory} onChange={(e) => { setMainCategory(e.target.value); setSubCategory("all"); }} className="w-full min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]">
              <option value="all">Бүх үндсэн ({questions.length})</option>
              {mainCategories.map((c) => <option key={c} value={c}>{c} ({questions.filter((q) => q.category === c).length})</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[12px] sm:text-sm font-medium">Дэд ангилал</span>
            <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)} className="w-full min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]">
              <option value="all">Бүх дэд ({mainCategory === "all" ? questions.length : questions.filter((q) => q.category === mainCategory).length})</option>
              {subCategories.map((c) => <option key={c} value={c}>{c} ({questions.filter((x) => (mainCategory === "all" || x.category === mainCategory) && x.subCategory === c).length})</option>)}
            </select>
          </label>

          <label className="grid gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[12px] sm:text-sm font-medium">Асуултын тоо (available: {poolSize})</span>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 min-w-0">
              {[10, 20, 30, 50, poolSize].filter((v, i, a) => a.indexOf(v) === i).map((n) => (
                <button key={n} onClick={() => setCount(n)} className={`rounded-full px-3 py-1.5 sm:px-5 sm:py-2 text-[12px] sm:text-sm border min-h-[32px] sm:min-h-[44px] shrink-0 ${count === n ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-50 dark:border-zinc-700"}`}>{n === poolSize ? `Бүгд (${n})` : n}</button>
              ))}
            </div>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
            <label className="grid gap-1.5 sm:gap-2 min-w-0">
              <span className="text-[12px] sm:text-sm font-medium">Горим</span>
              <div className="flex gap-1.5 sm:gap-2 min-w-0">
                <button onClick={() => setMode("exam")} className={`flex-1 min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm min-h-[36px] sm:min-h-[48px] ${mode === "exam" ? "bg-zinc-900 text-white" : "dark:border-zinc-700"}`}>Шалгалт</button>
                <button onClick={() => setMode("study")} className={`flex-1 min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm min-h-[36px] sm:min-h-[48px] ${mode === "study" ? "bg-zinc-900 text-white" : "dark:border-zinc-700"}`}>Сургалт</button>
              </div>
            </label>
            <label className="grid gap-1.5 sm:gap-2 min-w-0">
              <span className="text-[12px] sm:text-sm font-medium">Хугацаа (мин) — 0 = хязгааргүй</span>
              <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]">
                <option value={0}>Хязгааргүй</option>
                <option value={10}>10 мин</option>
                <option value={20}>20 мин</option>
                <option value={30}>30 мин</option>
                <option value={60}>60 мин</option>
              </select>
            </label>
          </div>

          <button onClick={start} disabled={poolSize === 0} className="w-full rounded-full bg-zinc-900 py-2.5 sm:py-3 font-medium text-[13px] sm:text-base text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 min-h-[40px] sm:min-h-[48px]">
            Эхлэх — {Math.min(count, poolSize)} асуулт
          </button>
        </div>
      </div>
    );
  }

  if (state === "running" && current) {
    const ans = answers[current.id];
    const correct = effectiveAnswer(current, overrides);
    const isUnknown = correct === null;
    const answered = ans !== undefined;
    return (
      <div className="mx-auto max-w-3xl w-full space-y-3 sm:space-y-4 min-w-0 overflow-hidden px-3 sm:px-0">
        <div className="rounded-xl sm:rounded-2xl border bg-white p-2.5 sm:p-4 flex items-center justify-between dark:bg-zinc-900 dark:border-zinc-800 gap-2 min-w-0 overflow-hidden">
          <span className="text-[12px] sm:text-sm font-medium shrink-0">{idx + 1} / {total}</span>
          <div className="h-1.5 sm:h-2 flex-1 mx-2 sm:mx-4 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full bg-zinc-900 dark:bg-white transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
          </div>
          {minutes > 0 ? <span className={`text-[12px] sm:text-sm font-mono shrink-0 ${timeLeft < 60 ? "text-red-600" : ""}`}>{fmt(timeLeft)}</span> : <span className="text-[12px] sm:text-sm font-mono shrink-0">{fmt(elapsed)}</span>}
        </div>

          <div className="rounded-xl sm:rounded-2xl border bg-white p-3 sm:p-6 dark:bg-zinc-900 dark:border-zinc-800 min-w-0 overflow-hidden">
          <p className="text-[11px] sm:text-sm text-zinc-500 break-words [overflow-wrap:anywhere] leading-snug">{current.category}{current.subCategory ? ` · ${current.subCategory}` : ""} · {current.id} {correct === null ? "· хариултгүй" : overrides[current.id] !== undefined ? "· Та хадгалсан" : ""}</p>
          <h2 className="mt-1.5 sm:mt-2 text-[14px] sm:text-lg font-medium leading-snug sm:leading-relaxed break-words [overflow-wrap:anywhere] min-w-0">{current.question}</h2>
          {isUnknown && <p className="mt-1.5 text-[11px] sm:text-xs rounded-full bg-amber-100 px-2 py-0.5 sm:px-3 sm:py-1 inline-block max-w-full break-words text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Зөв хариулт хараахан тодорхойгүй — Browse дээр хадгална уу</p>}

          <div className="mt-3 sm:mt-6 grid gap-1.5 sm:gap-3 min-w-0">
            {current.options.map((opt, i) => {
              const selected = ans === i;
              const showCorrect = mode === "study" && showStudyFeedback;
              const isCorrect = i === correct;
              return (
                <button
                  key={i}
                  onClick={() => { setAnswers((a) => ({ ...a, [current.id]: i })); if (mode === "study") setShowStudyFeedback(false); }}
                  className={`text-left rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 flex gap-2 sm:gap-3 text-[13px] sm:text-sm transition-colors min-w-0 overflow-hidden ${selected ? "border-zinc-900 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"} ${showCorrect && isCorrect ? "!border-green-500 !bg-green-50 !text-green-900 dark:!bg-green-950 dark:!text-green-100" : ""} ${showCorrect && selected && !isCorrect ? "!border-red-500 !bg-red-50 !text-red-900 dark:!bg-red-950 dark:!text-red-100" : ""}`}
                >
                  <span className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold ${selected ? "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>{letters[i]}</span>
                  <span className="flex-1 min-w-0 break-words [overflow-wrap:anywhere] leading-snug">{opt}</span>
                </button>
              );
            })}
          </div>

          {mode === "study" && answered && (
            <div className="mt-3 sm:mt-4 flex gap-2 min-w-0">
              {isUnknown ? (
                <p className="text-[12px] sm:text-sm text-amber-700 dark:text-amber-300 break-words">Зөв хариулт тодорхойгүй тул дүгнээгүй — Browse дээр хадгалж болно.</p>
              ) : !showStudyFeedback ? (
                <button onClick={() => setShowStudyFeedback(true)} className="rounded-full border px-4 py-1.5 sm:px-5 sm:py-2 text-[12px] sm:text-sm dark:border-zinc-700 shrink-0">Хариу шалгах</button>
              ) : (
                <p className={`text-[12px] sm:text-sm font-medium break-words min-w-0 ${ans === correct ? "text-green-600" : "text-red-600"}`}>{ans === correct ? "✓ Зөв!" : `✗ Буруу — зөв хариулт: ${letters[correct!]}`}{overrides[current.id] !== undefined ? " · Та хадгалсан" : ""}</p>
              )}
            </div>
          )}

          <div className="mt-4 sm:mt-6 flex justify-between gap-2 sm:gap-3 min-w-0">
            <button onClick={() => { setIdx((v) => Math.max(0, v - 1)); setShowStudyFeedback(false); }} disabled={idx === 0} className="rounded-full border px-4 py-2 sm:px-5 sm:py-2 text-[13px] sm:text-sm disabled:opacity-40 dark:border-zinc-700 min-h-[36px] sm:min-h-[44px] shrink-0">Өмнөх</button>
            {idx === total - 1 ? (
              <button onClick={submit} className="rounded-full bg-zinc-900 px-5 py-2 sm:px-6 sm:py-2 text-[13px] sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 min-h-[36px] sm:min-h-[44px] shrink-0">Дуусгах</button>
            ) : (
              <button onClick={() => { setIdx((v) => v + 1); setShowStudyFeedback(false); }} className="rounded-full bg-zinc-900 px-5 py-2 sm:px-6 sm:py-2 text-[13px] sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 min-h-[36px] sm:min-h-[44px] shrink-0">Дараах</button>
            )}
          </div>
        </div>

        {/* question jump */}
        <div className="flex flex-wrap gap-1 sm:gap-2 min-w-0 overflow-hidden">
          {quizQs.map((q, i) => (
            <button key={q.id} onClick={() => { setIdx(i); setShowStudyFeedback(false); }} className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full text-[12px] sm:text-sm border flex items-center justify-center ${i === idx ? "bg-zinc-900 text-white" : answers[q.id] !== undefined ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-300" : "bg-white dark:bg-zinc-900 dark:border-zinc-700"}`}>{i + 1}</button>
          ))}
        </div>
      </div>
    );
  }

  // result
  const pct = total ? Math.round((score / total) * 100) : 0;
  return (
    <div className="mx-auto max-w-3xl w-full space-y-3 sm:space-y-6 min-w-0 overflow-hidden px-3 sm:px-0">
      <div className="rounded-xl sm:rounded-2xl border bg-white p-4 sm:p-8 text-center dark:bg-zinc-900 dark:border-zinc-800 min-w-0 overflow-hidden">
        <h1 className="text-[16px] sm:text-2xl font-semibold">Дүн</h1>
        <p className="mt-1 sm:mt-2 text-3xl sm:text-5xl font-bold">{score} / {total}</p>
        <p className="mt-1 text-[12px] sm:text-base text-zinc-500">{pct}% · {fmt(elapsed)} зарцуулсан</p>
        <div className="mt-4 sm:mt-6 flex justify-center">
          <button onClick={() => setState("setup")} className="rounded-full bg-zinc-900 px-6 py-2 sm:px-8 sm:py-3 text-[13px] sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">Дахин эхлэх</button>
        </div>
      </div>

      <div className="space-y-2 sm:space-y-4 min-w-0">
        {quizQs.map((q, i) => {
          const a = answers[q.id];
          const c = effectiveAnswer(q, overrides);
          const unknown = c === null;
          const ok = !unknown && a === c;
          return (
            <div key={q.id} className={`rounded-xl sm:rounded-2xl border p-3 sm:p-6 min-w-0 overflow-hidden ${unknown ? "bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800" : ok ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"} dark:bg-zinc-900`}>
              <p className="text-[11px] sm:text-sm flex justify-between gap-2 min-w-0"><span className="min-w-0 break-words [overflow-wrap:anywhere] flex-1">{i + 1}. {q.category}{q.subCategory ? ` · ${q.subCategory}` : ""} {unknown ? "· хариултгүй" : overrides[q.id] !== undefined ? "· Та хадгалсан" : ""}</span><span className={`${unknown ? "text-zinc-500" : ok ? "text-green-700" : "text-red-700"} shrink-0`}>{unknown ? "— Тодорхойгүй" : ok ? "✓ Зөв" : "✗ Буруу"}</span></p>
              <p className="mt-1.5 sm:mt-2 font-medium break-words [overflow-wrap:anywhere] min-w-0 text-[13px] sm:text-base leading-snug">{q.question}</p>
              <div className="mt-2 sm:mt-3 grid gap-1.5 sm:gap-2 min-w-0">
                {q.options.map((opt, oi) => (
                  <div key={oi} className={`rounded-lg sm:rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 text-[12px] sm:text-sm flex gap-1.5 sm:gap-2 min-w-0 overflow-hidden ${!unknown && oi === c ? "border-green-500 bg-green-100 dark:bg-green-900" : ""} ${oi === a && !ok && !unknown ? "border-red-500 bg-red-100 dark:bg-red-900" : "bg-white dark:bg-zinc-800"}`}>
                    <span className="font-bold shrink-0">{letters[oi]}.</span><span className="flex-1 min-w-0 break-words [overflow-wrap:anywhere] leading-snug">{opt} {!unknown && oi === c && "✓"} {!unknown && oi === c && overrides[q.id] !== undefined && <span className="text-[10px]">· Та хадгалсан</span>} {oi === a && oi !== c && !unknown && "← таны сонголт"}</span>
                  </div>
                ))}
              </div>
              {unknown && <p className="mt-1.5 text-[11px] sm:text-xs text-zinc-500 break-words">Зөв хариулт хараахан тодорхойгүй — Browse дээр A–D сонгоод хадгална уу.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
