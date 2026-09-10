"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isAuthed = !!session?.user;
  const collator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }), []);
  const mainCategories = useMemo(() => ([...new Set(questions.map((x) => x.category).filter(Boolean))] as string[]).sort((a, b) => collator.compare(a, b)), [questions, collator]);
  // pre-filter from /browse practice link: ?main=&sub=&q=
  const [mainCategory, setMainCategory] = useState<string>(() => {
    const m = searchParams.get("main");
    return m && questions.some((x) => x.category === m) ? m : "all";
  });
  const [subCategory, setSubCategory] = useState<string>(() => searchParams.get("sub") || "all");
  const [query, setQuery] = useState<string>(() => searchParams.get("q") || "");
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
  const [customCount, setCustomCount] = useState("");
  const [subPick, setSubPick] = useState("");
  const [subDropOpen, setSubDropOpen] = useState(false);
  const [histAttempts, setHistAttempts] = useState<Array<{ category: string; score: number; total: number }>>([]);
  const [mode, setMode] = useState<Mode>("exam");
  const [minutes, setMinutes] = useState(20);

  const [quizQs, setQuizQs] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [optionOrder, setOptionOrder] = useState<Record<string, number[]>>({});
  const [showStudyFeedback, setShowStudyFeedback] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const [elapsed, setElapsed] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<"review" | "all" | "correct">("review");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [examTag, setExamTag] = useState<string | null>(null);

  // text pre-filter from /browse (?q=): narrows pool to matching questions
  const applyQuery = (pool: Question[]) => {
    const s = query.trim().toLowerCase();
    if (!s) return pool;
    return pool.filter((x) => x.question.toLowerCase().includes(s) || x.options.some((o) => o.toLowerCase().includes(s)));
  };

  // drop invalid ?sub= once real subcategory list is known
  useEffect(() => {
    if (subCategory !== "all" && !subCategories.includes(subCategory)) setSubCategory("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subCategories]);

  const start = (o: { main?: string; sub?: string; n?: number; mins?: number; m?: Mode; tag?: string } = {}) => {
    const mc = o.main ?? mainCategory;
    const sc = o.sub ?? subCategory;
    const nn = o.n ?? count;
    const mm = o.mins ?? minutes;
    if (o.m) setMode(o.m);
    setExamTag(o.tag ?? null);
    let pool = questions;
    if (mc !== "all") pool = pool.filter((q) => q.category === mc);
    if (sc !== "all") pool = pool.filter((q) => q.subCategory === sc);
    pool = applyQuery(pool);
    const picked = shuffle(pool).slice(0, Math.min(nn, pool.length));
    const order: Record<string, number[]> = {};
    picked.forEach((q) => { order[q.id] = shuffle(q.options.map((_, oi) => oi)); });
    setOptionOrder(order);
    setQuizQs(picked);
    setAnswers({});
    setConfirmExit(false);
    setSettingsOpen(false);
    setIdx(0);
    setTimeLeft(mm * 60);
    setElapsed(0);
    setShowStudyFeedback(false);
    setState("running");
  };

  // subcategory-only section: load saved attempts (DB if authed + local guest history)
  useEffect(() => {
    if (state !== "setup") return;
    try {
      const raw = localStorage.getItem("lawtest_attempts");
      const local = raw ? JSON.parse(raw) : [];
      if (Array.isArray(local)) setHistAttempts(local.filter((a) => a && typeof a.category === "string"));
    } catch { /* ignore */ }
    if (isAuthed) {
      fetch("/api/attempts")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && Array.isArray(d.attempts)) setHistAttempts((prev) => [...d.attempts, ...prev]); })
        .catch(() => {});
    }
  }, [state, isAuthed]);

  const subPairs = useMemo(() => {
    const map = new Map<string, { main: string; sub: string; count: number; label: string }>();
    questions.forEach((q) => {
      if (!q.category || !q.subCategory) return;
      const k = `${q.category} / ${q.subCategory}`;
      const e = map.get(k);
      if (e) e.count++;
      else map.set(k, { main: q.category as string, sub: q.subCategory as string, count: 1, label: k });
    });
    return [...map.values()].sort((a, b) => collator.compare(a.main, b.main) || collator.compare(a.sub, b.sub));
  }, [questions, collator]);

  const subPair = subPick === "" ? null : (subPairs[Number(subPick)] ?? null);

  const subStats = useMemo(() => {
    if (!subPair) return null;
    const list = histAttempts.filter((a) => a.category === subPair.label && typeof a.score === "number" && typeof a.total === "number" && a.total > 0);
    if (list.length === 0) return { n: 0, best: null as null | { score: number; total: number }, avg: 0, last: null as null | { score: number; total: number } };
    let best: { score: number; total: number } = list[0];
    let sum = 0;
    list.forEach((a) => { sum += a.score / a.total; if (a.score / a.total > best.score / best.total) best = a; });
    return { n: list.length, best, avg: Math.round((sum / list.length) * 100), last: list[0] as { score: number; total: number } };
  }, [subPair, histAttempts]);

  const mainExamStats = useMemo(() => {
    const list = histAttempts.filter((a) => a.category === "Үндсэн шалгалт" && typeof a.score === "number" && typeof a.total === "number" && a.total > 0);
    if (list.length === 0) return { n: 0, best: null as null | { score: number; total: number }, avg: 0, last: null as null | { score: number; total: number } };
    let best: { score: number; total: number } = list[0];
    let sum = 0;
    list.forEach((a) => { sum += a.score / a.total; if (a.score / a.total > best.score / best.total) best = a; });
    return { n: list.length, best, avg: Math.round((sum / list.length) * 100), last: list[0] as { score: number; total: number } };
  }, [histAttempts]);

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
      const catLabel = examTag ?? (mainCategory === "all" ? "all" : subCategory !== "all" ? `${mainCategory} / ${subCategory}` : mainCategory);
      // study mode never saves statistics
      if (mode === "exam") saveAttempt({ category: catLabel, mode, score: s, total: quizQs.length, elapsed: minutes * 60, answers, questionIds: quizQs.map((q) => q.id) }, isAuthed);
      setReviewFilter("review");
      setExpanded({});
      setState("result");
      return;
    }
    const id = setInterval(() => { setTimeLeft((t) => t - 1); setElapsed((e) => e + 1); }, 1000);
    return () => clearInterval(id);
  }, [state, timeLeft, minutes, quizQs, answers, mainCategory, subCategory, mode, isAuthed, examTag]);

  // also count elapsed when no timer
  useEffect(() => {
    if (state !== "running" || minutes !== 0) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [state, minutes]);

  // ask permission on accidental reload/close during exam
  useEffect(() => {
    if (state !== "running") return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [state]);

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

  // result dashboard stats: correct / wrong / unanswered / unknown
  const resultStats = useMemo(() => {
    let ok = 0, wrong = 0, un = 0, unk = 0;
    quizQs.forEach((q) => {
      const a = answers[q.id];
      const c = effectiveAnswer(q, overrides);
      if (c === null) unk++;
      else if (a === undefined) un++;
      else if (a === c) ok++;
      else wrong++;
    });
    return { ok, wrong, un, unk };
  }, [quizQs, answers, overrides]);

  // per main-category breakdown (unknown-answer questions excluded)
  const catBreakdown = useMemo(() => {
    const map = new Map<string, { ok: number; tot: number }>();
    quizQs.forEach((q) => {
      const c = effectiveAnswer(q, overrides);
      if (c === null) return;
      const key = (q.category as string) || "Бусад";
      const e = map.get(key) ?? { ok: 0, tot: 0 };
      e.tot++;
      if (answers[q.id] === c) e.ok++;
      map.set(key, e);
    });
    return [...map.entries()].sort((a, b) => collator.compare(a[0], b[0]));
  }, [quizQs, answers, overrides, collator]);

  const submit = () => {
    const catLabel = mainCategory === "all" ? "all" : subCategory !== "all" ? `${mainCategory} / ${subCategory}` : mainCategory;
    // study mode never saves statistics
    if (mode === "exam") saveAttempt({ category: catLabel, mode, score, total, elapsed: minutes === 0 ? elapsed : minutes * 60 - timeLeft, answers, questionIds: quizQs.map((q) => q.id) }, isAuthed);
    setReviewFilter("review");
    setExpanded({});
    setState("result");
  };

  // restart the SAME quiz: reshuffle questions + options, clear answers
  const restart = () => {
    const re = shuffle(quizQs);
    const order: Record<string, number[]> = {};
    re.forEach((q) => { order[q.id] = shuffle(q.options.map((_, oi) => oi)); });
    setOptionOrder(order);
    setQuizQs(re);
    setAnswers({});
    setExpanded({});
    setReviewFilter("review");
    setIdx(0);
    setTimeLeft(minutes * 60);
    setElapsed(0);
    setShowStudyFeedback(false);
    setState("running");
    window.scrollTo({ top: 0 });
  };

  // back to quiz main page (setup)
  const backToSetup = () => {
    setState("setup");
    window.scrollTo({ top: 0 });
  };

  const letters = ["A", "B", "C", "D", "E"];
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (state === "setup") {
    const pool = (() => {
      let out = questions;
      if (mainCategory !== "all") out = out.filter((x) => x.category === mainCategory);
      if (subCategory !== "all") out = out.filter((x) => x.subCategory === subCategory);
      return applyQuery(out);
    })();
    const poolSize = pool.length;
    const settingsSummary = `${mainCategory === "all" ? "Бүх үндсэн" : mainCategory} · ${subCategory === "all" ? "Бүх дэд" : subCategory} · ${count} асуулт · ${mode === "exam" ? "Шалгалт" : "Сургалт"} · ${minutes === 0 ? "Хязгааргүй" : `${minutes} мин`}`;
    return (
      <div className="mx-auto max-w-5xl w-full space-y-4 min-w-0 px-3 sm:px-0">
      <button onClick={() => setSettingsOpen(true)} className="w-full rounded-xl sm:rounded-2xl border bg-white p-3.5 sm:p-5 dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden text-left hover:border-zinc-400 transition-colors min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="font-semibold text-[14px] sm:text-base truncate">⚙ Шалгалт тохиргоо</span>
          <span className="text-[11px] sm:text-xs text-zinc-500 shrink-0">Өөрчлөх →</span>
        </div>
        <p className="mt-1 text-[11px] sm:text-sm text-zinc-500 break-words leading-snug">{settingsSummary}</p>
      </button>
      {query.trim() && (
        <div className="flex items-center justify-between gap-2 rounded-xl sm:rounded-2xl border border-dashed bg-white px-3.5 py-2.5 sm:px-5 sm:py-3 dark:bg-zinc-900 dark:border-zinc-700">
          <p className="min-w-0 truncate text-[12px] sm:text-sm">Шүүлтүүр: “{query.trim()}” — {poolSize} асуулт</p>
          <button onClick={() => setQuery("")} className="shrink-0 rounded-full border px-3 py-1 text-[11px] sm:text-xs dark:border-zinc-700">Арилгах</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0 items-start">
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <button aria-label="close" onClick={() => setSettingsOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl bg-white p-4 sm:p-8 shadow-xl dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-[16px] sm:text-2xl font-semibold break-words">Шалгалт тохиргоо</h1>
              <button onClick={() => setSettingsOpen(false)} aria-label="Хаах" className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border text-[13px] dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">✕</button>
            </div>
        <p className="mt-1 text-[11px] sm:text-sm text-zinc-500 leading-snug">{questions.length} асуулт бэлэн</p>

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

          <div className="grid gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[12px] sm:text-sm font-medium">Асуултын тоо (available: {poolSize})</span>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 min-w-0">
              {[10, 20, 30, 50, poolSize].filter((v, i, a) => a.indexOf(v) === i).map((n) => (
                <button key={n} onClick={() => { setCount(n); setCustomCount(""); }} className={`rounded-full px-3 py-1.5 sm:px-5 sm:py-2 text-[12px] sm:text-sm border min-h-[32px] sm:min-h-[44px] shrink-0 ${customCount === "" && count === n ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-50 dark:border-zinc-700"}`}>{n === poolSize ? `Бүгд (${n})` : n}</button>
              ))}
            </div>
            <label className="flex items-center gap-2 min-w-0">
              <span className="text-[12px] sm:text-sm text-zinc-500 shrink-0">Дурын тоо:</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={`1–${poolSize}`}
                value={customCount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  setCustomCount(raw);
                  if (raw === "") return;
                  const v = Math.floor(Number(raw));
                  if (!Number.isFinite(v)) return;
                  setCount(Math.min(Math.max(v, 1), Math.max(poolSize, 1)));
                }}
                className="w-28 min-w-0 rounded-lg sm:rounded-xl border px-3 py-1.5 sm:py-2 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[32px] sm:min-h-[44px]"
              />
              {customCount !== "" && (
                <span className="text-[12px] sm:text-sm font-medium">{count} сонгосон</span>
              )}
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
            <label className="grid gap-1.5 sm:gap-2 min-w-0">
              <span className="text-[12px] sm:text-sm font-medium">Горим</span>
              <div className="flex gap-1.5 sm:gap-2 min-w-0">
                <button onClick={() => { setMode("exam"); setMinutes((m) => (m === 0 ? 20 : m)); }} className={`flex-1 min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm min-h-[36px] sm:min-h-[48px] ${mode === "exam" ? "bg-zinc-900 text-white" : "dark:border-zinc-700"}`}>Шалгалт</button>
                <button onClick={() => { setMode("study"); setMinutes(0); }} className={`flex-1 min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm min-h-[36px] sm:min-h-[48px] ${mode === "study" ? "bg-zinc-900 text-white" : "dark:border-zinc-700"}`}>Сургалт</button>
              </div>
            </label>
            <label className={`grid gap-1.5 sm:gap-2 min-w-0 ${mode === "study" ? "opacity-50" : ""}`}>
              <span className="text-[12px] sm:text-sm font-medium">{mode === "study" ? "Хугацаа — түгжигдсэн · 00:00-ээс явна ⏱" : "Хугацаа (мин) — 0 = хязгааргүй"}</span>
              <select value={minutes} disabled={mode === "study"} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px] disabled:cursor-not-allowed">
                <option value={0}>Хязгааргүй</option>
                <option value={10}>10 мин</option>
                <option value={20}>20 мин</option>
                <option value={30}>30 мин</option>
                <option value={60}>60 мин</option>
                <option value={200}>200 мин (үндсэн)</option>
              </select>
            </label>
          </div>

          <button onClick={() => start()} disabled={poolSize === 0} className="w-full rounded-full bg-zinc-900 py-2.5 sm:py-3 font-medium text-[13px] sm:text-base text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 min-h-[40px] sm:min-h-[48px]">
            Эхлэх — {Math.min(count, poolSize)} асуулт
          </button>
        </div>
          </div>
        </div>
      )}

      <div className="w-full min-w-0 rounded-xl sm:rounded-2xl border bg-white p-4 sm:p-8 dark:bg-zinc-900 dark:border-zinc-800">
        <h2 className="text-[14px] sm:text-xl font-semibold break-words">Дэд ангиллаар шалгалт</h2>
        <p className="mt-1 text-[11px] sm:text-sm text-zinc-500 leading-snug">Зөвхөн нэг дэд ангилал сонгоод шалгалт өгнө — дүн хадгалагдаж, статистик нь энд харагдана{isAuthed ? "" : " (нэвтрээгүй үед энэ төхөөрөмжид хадгалагдана)"}.</p>

        <div className="mt-3 sm:mt-4 grid gap-1.5 sm:gap-2 min-w-0">
          <span className="text-[12px] sm:text-sm font-medium">Дэд ангилал</span>
          <div className="relative min-w-0">
            <button type="button" onClick={() => setSubDropOpen((v) => !v)} className="flex w-full max-w-full min-w-0 items-center justify-between gap-2 rounded-lg sm:rounded-xl border bg-white px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]">
              <span className="truncate text-left">{subPair ? `${subPair.main} / ${subPair.sub} (${subPair.count})` : "Дэд ангилал сонгох…"}</span>
              <span className="shrink-0 text-xs text-zinc-400">{subDropOpen ? "▴" : "▾"}</span>
            </button>
            {subDropOpen && (
              <>
                <button aria-label="close" onClick={() => setSubDropOpen(false)} className="fixed inset-0 z-10 cursor-default bg-transparent" />
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg sm:rounded-xl border bg-white py-1 shadow-xl dark:bg-zinc-800 dark:border-zinc-700">
                  {mainCategories.map((m) => (
                    <div key={m}>
                      <p className="truncate px-3 pt-2 pb-0.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{m}</p>
                      {subPairs.map((p, i) => p.main === m ? (
                        <button key={i} type="button" title={`${p.sub} (${p.count})`} onClick={() => { setSubPick(String(i)); setSubDropOpen(false); }} className={`block w-full truncate px-3 py-2 text-left text-[12px] sm:text-[13px] hover:bg-zinc-100 dark:hover:bg-zinc-700 ${subPick === String(i) ? "bg-zinc-100 dark:bg-zinc-700 font-medium" : ""}`}>
                          {p.sub} ({p.count})
                        </button>
                      ) : null)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {subPair && (
          <div className="mt-3 sm:mt-4 min-w-0">
            {subStats && subStats.n > 0 && subStats.best && subStats.last ? (
              <div className="rounded-lg sm:rounded-xl bg-zinc-50 p-3 sm:p-4 dark:bg-zinc-800">
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                  <div>
                    <p className="text-[16px] sm:text-2xl font-bold leading-none">{subStats.n}</p>
                    <p className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">Оролдлого</p>
                  </div>
                  <div>
                    <p className="text-[16px] sm:text-2xl font-bold leading-none">{subStats.best.score}/{subStats.best.total}</p>
                    <p className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">Шилдэг</p>
                  </div>
                  <div>
                    <p className="text-[16px] sm:text-2xl font-bold leading-none">{subStats.avg}%</p>
                    <p className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">Дундаж</p>
                  </div>
                </div>
                <p className="mt-2 text-center text-[11px] sm:text-xs text-zinc-500">Сүүлд: {subStats.last.score}/{subStats.last.total}</p>
              </div>
            ) : (
              <p className="rounded-lg sm:rounded-xl bg-zinc-50 p-3 sm:p-4 text-[12px] sm:text-sm text-zinc-500 dark:bg-zinc-800">Энэ дэд ангиллаар оролдлого байхгүй байна — эхлээд шалгалт өгнө үү.</p>
            )}
            <button
              onClick={() => { setMainCategory(subPair.main); setSubCategory(subPair.sub); setCount(subPair.count); setCustomCount(""); start({ main: subPair.main, sub: subPair.sub, n: subPair.count }); }}
              disabled={subPair.count === 0}
              className="mt-3 sm:mt-4 w-full rounded-full bg-zinc-900 py-2.5 sm:py-3 font-medium text-[13px] sm:text-base text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 min-h-[40px] sm:min-h-[48px]"
            >
              Эхлэх — бүх {subPair.count} асуулт
            </button>
          </div>
        )}
      </div>

      <div className="w-full min-w-0 rounded-xl sm:rounded-2xl bg-zinc-950 border border-zinc-800 p-4 sm:p-8 text-white dark:bg-zinc-900 dark:border-zinc-700 overflow-hidden">
        <h2 className="text-[14px] sm:text-xl font-semibold break-words">Үндсэн шалгалт</h2>
        <p className="mt-1 text-[11px] sm:text-sm leading-snug text-zinc-300">Бодит шалгалтын форматаар — бүх сангаас 200 асуулт, 200 минут, шалгалтын горим. Үсэг нуугдаж, хариултууд холигдоно.</p>
        <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
          <div className="rounded-lg bg-white/10 p-2 sm:p-3">
            <p className="text-[16px] sm:text-2xl font-bold leading-none">200</p>
            <p className="text-[10px] sm:text-xs text-zinc-300 mt-0.5">Асуулт</p>
          </div>
          <div className="rounded-lg bg-white/10 p-2 sm:p-3">
            <p className="text-[16px] sm:text-2xl font-bold leading-none">200</p>
            <p className="text-[10px] sm:text-xs text-zinc-300 mt-0.5">Минут</p>
          </div>
          <div className="rounded-lg bg-white/10 p-2 sm:p-3">
            <p className="text-[16px] sm:text-2xl font-bold leading-none">{mainExamStats.n > 0 ? `${mainExamStats.avg}%` : "—"}</p>
            <p className="text-[10px] sm:text-xs text-zinc-300 mt-0.5">Дундаж{mainExamStats.n > 0 ? ` · ${mainExamStats.n}` : ""}</p>
          </div>
        </div>
        {mainExamStats.n > 0 && mainExamStats.best && mainExamStats.last && (
          <p className="mt-2 text-center text-[11px] sm:text-xs text-zinc-300">Оролдлого: {mainExamStats.n} · Шилдэг: {mainExamStats.best.score}/{mainExamStats.best.total} · Сүүлд: {mainExamStats.last.score}/{mainExamStats.last.total}</p>
        )}
        <button
          onClick={() => { setMainCategory("all"); setSubCategory("all"); setCount(200); setCustomCount(""); setMinutes(200); start({ n: 200, mins: 200, m: "exam", tag: "Үндсэн шалгалт" }); }}
          disabled={questions.length === 0}
          className="mt-3 sm:mt-4 w-full rounded-full bg-white py-2.5 sm:py-3 font-semibold text-[13px] sm:text-base text-zinc-900 hover:bg-zinc-100 disabled:opacity-40 min-h-[40px] sm:min-h-[48px]"
        >
          Үндсэн шалгалт эхлэх
        </button>
      </div>
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
          {minutes > 0 ? <span className={`text-[12px] sm:text-sm font-mono shrink-0 ${timeLeft < 60 ? "text-red-600" : ""}`}>{fmt(timeLeft)}</span> : <span title="Зарцуулсан хугацаа" className="text-[12px] sm:text-sm font-mono shrink-0">⏱ {fmt(elapsed)}</span>}
          <button onClick={() => setConfirmExit(true)} aria-label="Шалгалт цуцлах" title="Шалгалт цуцлах" className="shrink-0 inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border text-[12px] sm:text-sm dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">✕</button>
        </div>

          <div className="rounded-xl sm:rounded-2xl border bg-white p-3 sm:p-6 dark:bg-zinc-900 dark:border-zinc-800 min-w-0 overflow-hidden">
          <h2 className="text-[14px] sm:text-lg font-medium leading-snug sm:leading-relaxed break-words [overflow-wrap:anywhere] min-w-0">{current.question}</h2>
          {isUnknown && <p className="mt-1.5 text-[11px] sm:text-xs rounded-full bg-amber-100 px-2 py-0.5 sm:px-3 sm:py-1 inline-block max-w-full break-words text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Зөв хариулт хараахан тодорхойгүй — Browse дээр хадгална уу</p>}

          <div className="mt-3 sm:mt-6 grid gap-1.5 sm:gap-3 min-w-0">
            {(optionOrder[current.id] ?? current.options.map((_, oi) => oi)).map((oi) => {
              const opt = current.options[oi];
              const selected = ans === oi;
              const showCorrect = mode === "study" && showStudyFeedback;
              const isCorrect = oi === correct;
              return (
                <button
                  key={oi}
                  onClick={() => { setAnswers((a) => ({ ...a, [current.id]: oi })); if (mode === "study") setShowStudyFeedback(false); }}
                  className={`text-left rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 flex gap-2 sm:gap-3 text-[13px] sm:text-sm transition-colors min-w-0 overflow-hidden ${selected ? "border-zinc-900 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"} ${showCorrect && isCorrect ? "!border-green-500 !bg-green-50 !text-green-900 dark:!bg-green-950 dark:!text-green-100" : ""} ${showCorrect && selected && !isCorrect ? "!border-red-500 !bg-red-50 !text-red-900 dark:!bg-red-950 dark:!text-red-100" : ""}`}
                >
                  <span className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold ${selected ? "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>•</span>
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
                <p className={`text-[12px] sm:text-sm font-medium break-words min-w-0 ${ans === correct ? "text-green-600" : "text-red-600"}`}>{ans === correct ? "✓ Зөв!" : "✗ Буруу"}</p>
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

        {/* confirm exit exam (no save) */}
        {confirmExit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setConfirmExit(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-zinc-900 dark:border dark:border-zinc-800">
              <h3 className="font-semibold text-[14px] sm:text-base">Шалгалтыг цуцлах уу?</h3>
              <p className="mt-2 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">Дүн хадгалагдахгүй — хариултууд устаж, тохиргоо руу буцна.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setConfirmExit(false)} className="rounded-full border px-5 py-2 text-[13px] sm:text-sm dark:border-zinc-700 min-h-[36px]">Үргэлжлүүлэх</button>
                <button onClick={() => { setConfirmExit(false); setShowStudyFeedback(false); setState("setup"); }} className="rounded-full bg-red-600 px-5 py-2 text-[13px] sm:text-sm font-medium text-white min-h-[36px]">Цуцлах</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // result
  const pct = total ? Math.round((score / total) * 100) : 0;
  const statusOf = (q: Question) => {
    const a = answers[q.id];
    const c = effectiveAnswer(q, overrides);
    if (c === null) return "unknown" as const;
    if (a === undefined) return "unanswered" as const;
    return a === c ? ("correct" as const) : ("wrong" as const);
  };
  // default to mistakes-only view; fall back to all when nothing to fix
  const effFilter = resultStats.wrong + resultStats.un > 0 ? reviewFilter : "all";
  const reviewItems = quizQs
    .map((q, i) => ({ q, i, st: statusOf(q) }))
    .filter(({ st }) => effFilter === "all" ? true : effFilter === "correct" ? st === "correct" : (st === "wrong" || st === "unanswered"));
  const allOpen = reviewItems.length > 0 && reviewItems.every(({ q }) => expanded[q.id]);
  const dotCls = (st: string) =>
    st === "correct" ? "bg-green-600 text-white" :
    st === "wrong" ? "bg-red-600 text-white" :
    st === "unanswered" ? "bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" :
    "bg-amber-400 text-white";
  const dotSym = (st: string) => (st === "correct" ? "✓" : st === "wrong" ? "✗" : st === "unanswered" ? "○" : "?");
  return (
    <div className="mx-auto max-w-3xl w-full space-y-3 sm:space-y-6 min-w-0 overflow-hidden px-3 sm:px-0">
      {/* summary dashboard */}
      <div className="rounded-xl sm:rounded-2xl border bg-white p-4 sm:p-8 text-center dark:bg-zinc-900 dark:border-zinc-800 min-w-0 overflow-hidden">
        <h1 className="text-[16px] sm:text-2xl font-semibold">Дүн</h1>
        <p className="mt-1 sm:mt-2 text-3xl sm:text-5xl font-bold">{score} / {total}</p>
        <p className="mt-1 text-[12px] sm:text-base text-zinc-500">{pct}% · {fmt(elapsed)} зарцуулсан</p>
        {mode === "study" && <p className="mt-1 text-[11px] sm:text-xs text-amber-700 dark:text-amber-300">Сургалтын горим — дүн түүхэнд хадгалагдаагүй</p>}

        {/* stat chips */}
        <div className="mt-3 sm:mt-4 flex flex-wrap justify-center gap-1.5 sm:gap-2">
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200">✓ Зөв · {resultStats.ok}</span>
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">✗ Буруу · {resultStats.wrong}</span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">○ Хариулаагүй · {resultStats.un}</span>
          {resultStats.unk > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">? Тодорхойгүй · {resultStats.unk}</span>}
        </div>

        {/* per-category breakdown */}
        {catBreakdown.length > 1 && (
          <div className="mt-4 sm:mt-5 grid gap-1.5 sm:gap-2 text-left">
            {catBreakdown.map(([name, v]) => {
              const p = v.tot ? Math.round((v.ok / v.tot) * 100) : 0;
              return (
                <div key={name} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                    <span className="truncate text-zinc-600 dark:text-zinc-400">{name}</span>
                    <span className="shrink-0 font-medium">{v.ok}/{v.tot} · {p}%</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full ${p >= 70 ? "bg-green-500" : p >= 40 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 sm:mt-6 flex justify-center gap-2">
          <button onClick={backToSetup} className="rounded-full border px-5 py-2 sm:px-6 sm:py-3 text-[13px] sm:text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 min-h-[36px] sm:min-h-0">← Шалгалт</button>
          <button onClick={restart} className="rounded-full bg-zinc-900 px-6 py-2 sm:px-8 sm:py-3 text-[13px] sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 min-h-[36px] sm:min-h-0">Дахин эхлэх</button>
        </div>
      </div>

      {/* review: filter tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5">
        <span className="text-[12px] sm:text-sm font-medium shrink-0 mr-1">Шалгах:</span>
        {([
          { k: "review", label: `Алдсан · ${resultStats.wrong + resultStats.un}` },
          { k: "all", label: `Бүгд · ${total}` },
          { k: "correct", label: `Зөв · ${resultStats.ok}` },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setReviewFilter(t.k)}
            className={`shrink-0 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-[12px] sm:text-sm border min-h-[32px] sm:min-h-[36px] ${(resultStats.wrong + resultStats.un > 0 ? reviewFilter : "all") === t.k ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700"}`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => {
            if (allOpen) setExpanded({});
            else { const o: Record<string, boolean> = {}; reviewItems.forEach(({ q }) => { o[q.id] = true; }); setExpanded((p) => ({ ...p, ...o })); }
          }}
          className="shrink-0 ml-auto text-[11px] sm:text-xs underline text-zinc-500"
        >
          {allOpen ? "Бүгдийг хураах" : "Бүгдийг нээх"}
        </button>
      </div>

      {/* review: collapsed rows, tap to expand */}
      <div className="space-y-2 sm:space-y-4 min-w-0">
        {reviewItems.map(({ q, i, st }) => {
          const a = answers[q.id];
          const c = effectiveAnswer(q, overrides);
          const unknown = st === "unknown";
          const ok = st === "correct";
          const open = !!expanded[q.id];
          return (
            <div key={q.id} className={`rounded-xl sm:rounded-2xl border min-w-0 overflow-hidden ${unknown ? "bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800" : ok ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"} dark:bg-zinc-900`}>
              <button onClick={() => setExpanded((p) => ({ ...p, [q.id]: !p[q.id] }))} className="w-full flex items-center gap-2 p-3 sm:p-4 text-left min-w-0">
                <span className={`flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold ${dotCls(st)}`}>{dotSym(st)}</span>
                <span className="text-zinc-400 text-[11px] sm:text-sm shrink-0">{i + 1}.</span>
                <span className={`flex-1 min-w-0 text-[13px] sm:text-sm leading-snug break-words ${open ? "" : "line-clamp-2"}`}>{q.question}</span>
                <span className="text-zinc-400 text-xs shrink-0">{open ? "▾" : "▸"}</span>
              </button>
              {open && (
                <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                  <p className="text-[10px] sm:text-xs text-zinc-500 break-words">{q.category}{q.subCategory ? ` · ${q.subCategory}` : ""} {unknown ? "· хариултгүй" : overrides[q.id] !== undefined ? "· Та хадгалсан" : ""} {st === "unanswered" ? "· хариулаагүй" : ""}</p>
                  <div className="mt-2 grid gap-1.5 sm:gap-2 min-w-0">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className={`rounded-lg sm:rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 text-[12px] sm:text-sm flex gap-1.5 sm:gap-2 min-w-0 overflow-hidden ${!unknown && oi === c ? "border-green-500 bg-green-100 dark:bg-green-900" : ""} ${oi === a && !ok && !unknown ? "border-red-500 bg-red-100 dark:bg-red-900" : "bg-white dark:bg-zinc-800"}`}>
                        <span className="font-bold shrink-0">{letters[oi]}.</span><span className="flex-1 min-w-0 break-words [overflow-wrap:anywhere] leading-snug">{opt} {!unknown && oi === c && "✓"} {!unknown && oi === c && overrides[q.id] !== undefined && <span className="text-[10px]">· Та хадгалсан</span>} {oi === a && oi !== c && !unknown && "← таны сонголт"}</span>
                      </div>
                    ))}
                  </div>
                  {unknown && <p className="mt-1.5 text-[11px] sm:text-xs text-zinc-500 break-words">Зөв хариулт хараахан тодорхойгүй — Browse дээр A–D сонгоод хадгална уу.</p>}
                </div>
              )}
            </div>
          );
        })}
        {reviewItems.length === 0 && <p className="text-center py-8 text-[13px] sm:text-sm text-zinc-500">Бүгд зөв — мундаг! 🎉</p>}
      </div>

      {/* bottom nav back to quiz */}
      <div className="flex justify-center gap-2 pb-2">
        <button onClick={backToSetup} className="rounded-full border px-5 py-2 text-[13px] sm:text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 min-h-[36px]">← Шалгалт</button>
        <button onClick={restart} className="rounded-full bg-zinc-900 px-6 py-2 text-[13px] sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 min-h-[36px]">Дахин эхлэх</button>
      </div>
    </div>
  );
}
