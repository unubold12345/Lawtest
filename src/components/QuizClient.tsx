"use client";
import { useEffect, useMemo, useState } from "react";
import type { Question } from "@/types/question";

type Mode = "exam" | "study";
type QuizState = "setup" | "running" | "result";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export default function QuizClient({ questions }: { questions: Question[] }) {
  const categories = useMemo(() => [...new Set(questions.map((x) => x.category).filter(Boolean))] as string[], [questions]);

  const [state, setState] = useState<QuizState>("setup");
  const [category, setCategory] = useState("all");
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
    if (category !== "all") pool = pool.filter((q) => q.category === category);
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
        const c = typeof q.answer === "number" ? q.answer : (q.answer as number[])[0];
        return acc + (a === c ? 1 : 0);
      }, 0);
      const attempt = { id: Date.now().toString(), date: new Date().toISOString(), category, count: quizQs.length, mode, score: s, total: quizQs.length, elapsed: minutes * 60, answers, questionIds: quizQs.map((q) => q.id) };
      const raw = localStorage.getItem("lawtest_attempts");
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift(attempt);
      localStorage.setItem("lawtest_attempts", JSON.stringify(arr.slice(0, 50)));
      setState("result");
      return;
    }
    const id = setInterval(() => { setTimeLeft((t) => t - 1); setElapsed((e) => e + 1); }, 1000);
    return () => clearInterval(id);
  }, [state, timeLeft, minutes, quizQs, answers, category, mode]);

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
      const correct = typeof q.answer === "number" ? q.answer : q.answer[0];
      if (a === correct) s++;
    });
    return s;
  }, [quizQs, answers]);

  const submit = () => {
    const attempt = { id: Date.now().toString(), date: new Date().toISOString(), category, count: total, mode, score, total, elapsed: minutes === 0 ? elapsed : minutes * 60 - timeLeft, answers, questionIds: quizQs.map((q) => q.id) };
    const raw = localStorage.getItem("lawtest_attempts");
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift(attempt);
    localStorage.setItem("lawtest_attempts", JSON.stringify(arr.slice(0, 50)));
    setState("result");
  };

  const letters = ["A", "B", "C", "D", "E"];
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (state === "setup") {
    const poolSize = category === "all" ? questions.length : questions.filter((q) => q.category === category).length;
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-8 dark:bg-zinc-900 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold">Шалгалт тохиргоо</h1>
        <p className="mt-2 text-sm text-zinc-500">{questions.length} асуулт бэлэн · {categories.join(", ")}</p>

        <div className="mt-8 grid gap-6">
          <label className="grid gap-2">
            <span className="text-sm font-medium">Ангилал</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border px-4 py-3 dark:bg-zinc-800 dark:border-zinc-700">
              <option value="all">Бүх ангилал ({questions.length})</option>
              {categories.map((c) => <option key={c} value={c}>{c} ({questions.filter((q) => q.category === c).length})</option>)}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Асуултын тоо (available: {poolSize})</span>
            <div className="flex flex-wrap gap-2">
              {[10, 20, 30, 50, poolSize].filter((v, i, a) => a.indexOf(v) === i).map((n) => (
                <button key={n} onClick={() => setCount(n)} className={`rounded-full px-5 py-2 text-sm border ${count === n ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-50 dark:border-zinc-700"}`}>{n === poolSize ? `Бүгд (${n})` : n}</button>
              ))}
            </div>
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Горим</span>
              <div className="flex gap-2">
                <button onClick={() => setMode("exam")} className={`flex-1 rounded-xl border px-4 py-3 text-sm ${mode === "exam" ? "bg-zinc-900 text-white" : "dark:border-zinc-700"}`}>Шалгалт — эцэст дүгнэх</button>
                <button onClick={() => setMode("study")} className={`flex-1 rounded-xl border px-4 py-3 text-sm ${mode === "study" ? "bg-zinc-900 text-white" : "dark:border-zinc-700"}`}>Сургалт — шууд хариу</button>
              </div>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">Хугацаа (мин) — 0 = хязгааргүй</span>
              <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="rounded-xl border px-4 py-3 dark:bg-zinc-800 dark:border-zinc-700">
                <option value={0}>Хязгааргүй</option>
                <option value={10}>10 мин</option>
                <option value={20}>20 мин</option>
                <option value={30}>30 мин</option>
                <option value={60}>60 мин</option>
              </select>
            </label>
          </div>

          <button onClick={start} disabled={poolSize === 0} className="rounded-full bg-zinc-900 py-3 font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900">
            Эхлэх — {Math.min(count, poolSize)} асуулт
          </button>
        </div>
      </div>
    );
  }

  if (state === "running" && current) {
    const ans = answers[current.id];
    const correct = typeof current.answer === "number" ? current.answer : (current.answer as number[])[0];
    const answered = ans !== undefined;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border bg-white p-4 flex items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
          <span className="text-sm font-medium">{idx + 1} / {total}</span>
          <div className="h-2 flex-1 mx-4 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full bg-zinc-900 dark:bg-white transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
          </div>
          {minutes > 0 ? <span className={`text-sm font-mono ${timeLeft < 60 ? "text-red-600" : ""}`}>{fmt(timeLeft)}</span> : <span className="text-sm font-mono">{fmt(elapsed)}</span>}
        </div>

        <div className="rounded-2xl border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">{current.category} · {current.id}</p>
          <h2 className="mt-2 text-lg font-medium leading-relaxed">{current.question}</h2>

          <div className="mt-6 grid gap-3">
            {current.options.map((opt, i) => {
              const selected = ans === i;
              const showCorrect = mode === "study" && showStudyFeedback;
              const isCorrect = i === correct;
              return (
                <button
                  key={i}
                  onClick={() => { setAnswers((a) => ({ ...a, [current.id]: i })); if (mode === "study") setShowStudyFeedback(false); }}
                  className={`text-left rounded-xl border px-4 py-3 flex gap-3 text-sm transition-colors ${selected ? "border-zinc-900 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"} ${showCorrect && isCorrect ? "!border-green-500 !bg-green-50 !text-green-900 dark:!bg-green-950 dark:!text-green-100" : ""} ${showCorrect && selected && !isCorrect ? "!border-red-500 !bg-red-50 !text-red-900 dark:!bg-red-950 dark:!text-red-100" : ""}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selected ? "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>{letters[i]}</span>
                  {opt}
                </button>
              );
            })}
          </div>

          {mode === "study" && answered && (
            <div className="mt-4 flex gap-2">
              {!showStudyFeedback ? (
                <button onClick={() => setShowStudyFeedback(true)} className="rounded-full border px-5 py-2 text-sm dark:border-zinc-700">Хариу шалгах</button>
              ) : (
                <p className={`text-sm font-medium ${ans === correct ? "text-green-600" : "text-red-600"}`}>{ans === correct ? "✓ Зөв!" : `✗ Буруу — зөв хариулт: ${letters[correct]}`}</p>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button onClick={() => { setIdx((v) => Math.max(0, v - 1)); setShowStudyFeedback(false); }} disabled={idx === 0} className="rounded-full border px-5 py-2 text-sm disabled:opacity-40 dark:border-zinc-700">Өмнөх</button>
            {idx === total - 1 ? (
              <button onClick={submit} className="rounded-full bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">Дуусгах</button>
            ) : (
              <button onClick={() => { setIdx((v) => v + 1); setShowStudyFeedback(false); }} className="rounded-full bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">Дараах</button>
            )}
          </div>
        </div>

        {/* question jump */}
        <div className="flex flex-wrap gap-2">
          {quizQs.map((q, i) => (
            <button key={q.id} onClick={() => { setIdx(i); setShowStudyFeedback(false); }} className={`h-9 w-9 rounded-full text-sm border ${i === idx ? "bg-zinc-900 text-white" : answers[q.id] !== undefined ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-300" : "bg-white dark:bg-zinc-900 dark:border-zinc-700"}`}>{i + 1}</button>
          ))}
        </div>
      </div>
    );
  }

  // result
  const pct = total ? Math.round((score / total) * 100) : 0;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border bg-white p-8 text-center dark:bg-zinc-900 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold">Дүн</h1>
        <p className="mt-2 text-5xl font-bold">{score} / {total}</p>
        <p className="mt-1 text-zinc-500">{pct}% · {fmt(elapsed)} зарцуулсан</p>
        <div className="mt-6 flex justify-center">
          <button onClick={() => setState("setup")} className="rounded-full bg-zinc-900 px-8 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">Дахин эхлэх</button>
        </div>
      </div>

      <div className="space-y-4">
        {quizQs.map((q, i) => {
          const a = answers[q.id];
          const c = typeof q.answer === "number" ? q.answer : (q.answer as number[])[0];
          const ok = a === c;
          return (
            <div key={q.id} className={`rounded-2xl border p-6 ${ok ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"} dark:bg-zinc-900`}>
              <p className="text-sm flex justify-between"><span>{i + 1}. {q.category}</span><span className={ok ? "text-green-700" : "text-red-700"}>{ok ? "✓ Зөв" : "✗ Буруу"}</span></p>
              <p className="mt-2 font-medium">{q.question}</p>
              <div className="mt-3 grid gap-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className={`rounded-xl border px-3 py-2 text-sm flex gap-2 ${oi === c ? "border-green-500 bg-green-100 dark:bg-green-900" : ""} ${oi === a && !ok ? "border-red-500 bg-red-100 dark:bg-red-900" : "bg-white dark:bg-zinc-800"}`}>
                    <span className="font-bold">{letters[oi]}.</span>{opt} {oi === c && "✓"} {oi === a && oi !== c && "← таны сонголт"}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
