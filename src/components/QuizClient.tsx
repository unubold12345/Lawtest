"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Question } from "@/types/question";
import { fileHasAnswer, getAllOverrides } from "@/lib/answerOverrides";
import { fileAnswer, judgeQuestion } from "@/lib/voteJudge";
import { readLocalSavedExams, writeLocalSavedExam, removeLocalSavedExam, type SavedExam } from "@/lib/savedExams";
import { FREE_CATEGORY } from "@/lib/access";

type Mode = "exam" | "study";
type QuizState = "setup" | "running" | "result";

type Attempt = {
  id: string;
  date: string;
  category: string;
  mode: string;
  score: number;
  total: number;
  elapsed?: number;
};

function readLocalAttempts(): Attempt[] {
  try {
    const raw = localStorage.getItem("lawtest_attempts");
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

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
  const { data: session, status: sessionStatus } = useSession();
  const isAuthed = !!session?.user;
  const fullAccess =
    (session?.user as unknown as { hasPaid?: boolean; role?: string } | undefined)?.hasPaid === true ||
    (session?.user as unknown as { role?: string } | undefined)?.role === "ADMIN";
  // unpaid users only get the free category in exam pools (lists stay visible)
  const poolBase = useMemo(
    () => (fullAccess ? questions : questions.filter((x) => x.category === FREE_CATEGORY)),
    [questions, fullAccess]
  );
  const [paywallNote, setPaywallNote] = useState(false);
  const accessRef = useRef(true);
  accessRef.current = fullAccess;
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

  // community votes for no-answer questions: per-option tallies + my saved vote
  const [voteCounts, setVoteCounts] = useState<Record<string, number[]>>({});
  const [voteMy, setVoteMy] = useState<Record<string, number>>({});
  const loadVotes = (ids: string[]) => {
    const list = [...new Set(ids)].filter(Boolean).slice(0, 2000);
    if (list.length === 0) return;
    fetch("/api/saved-answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: list }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (d.counts) setVoteCounts((p) => ({ ...p, ...d.counts }));
        if (d.my) setVoteMy((p) => ({ ...p, ...d.my }));
      })
      .catch(() => {});
  };
  // resolved answer: file (locked) → my saved → majority vote → auto-correct (tie/none)
  const judgeOf = useCallback((q: Question) => judgeQuestion(q, { overrides, my: voteMy, counts: voteCounts }), [overrides, voteMy, voteCounts]);

  const [state, setState] = useState<QuizState>("setup");
  const [count, setCount] = useState(20);
  const [customCount, setCustomCount] = useState("");
  const [lastExam, setLastExam] = useState<Attempt | null>(null);
  useEffect(() => {
    let cancelled = false;
    const pick = (arr: Attempt[]) => arr.find((a) => a.mode === "exam") ?? null;
    if (isAuthed) {
      fetch("/api/attempts")
        .then((r) => (r.ok ? r.json() : { attempts: [] }))
        .then((d) => { if (!cancelled) setLastExam(pick(d.attempts || [])); })
        .catch(() => { if (!cancelled) setLastExam(pick(readLocalAttempts())); });
    } else {
      setLastExam(pick(readLocalAttempts()));
    }
    return () => { cancelled = true; };
  }, [isAuthed]);
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
  const [pendingDeleteExam, setPendingDeleteExam] = useState<string | null>(null);
  const [examsModalOpen, setExamsModalOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const [elapsed, setElapsed] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<"review" | "all" | "correct">("review");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [examTag, setExamTag] = useState<string | null>(null);
  const [runLabel, setRunLabel] = useState<string>("all");
  const [savedExams, setSavedExams] = useState<Record<string, SavedExam>>({});
  const [mistakes, setMistakes] = useState<Record<string, { wrongCount: number; manual: boolean }>>({});
  const [mistakesOpen, setMistakesOpen] = useState(false);

  // load saved (paused) exams: local always, DB merge when authed
  useEffect(() => {
    if (state !== "setup") return;
    const local = readLocalSavedExams();
    setSavedExams(local);
    if (isAuthed) {
      fetch("/api/saved-exams")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.exams) return;
          const merged: Record<string, SavedExam> = { ...local };
          (d.exams as Array<{ key: string; data: SavedExam; updatedAt: number }>).forEach((row) => {
            const rec: SavedExam = { ...row.data, key: row.key, updatedAt: row.updatedAt };
            const cur = merged[row.key];
            if (!cur || (row.updatedAt || 0) > (cur.updatedAt || 0)) merged[row.key] = rec;
          });
          setSavedExams(merged);
        })
        .catch(() => {});
    }
  }, [state, isAuthed]);

  // mistakes (Их алддаг сорилгууд): wrongCount>=2 or manually added shows in section
  useEffect(() => {
    if (!isAuthed) { setMistakes({}); return; }
    fetch("/api/mistakes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.mistakes) return;
        const m: Record<string, { wrongCount: number; manual: boolean }> = {};
        (d.mistakes as Array<{ questionId: string; wrongCount: number; manual: boolean }>).forEach((row) => {
          m[row.questionId] = { wrongCount: row.wrongCount, manual: row.manual };
        });
        setMistakes(m);
      })
      .catch(() => {});
  }, [isAuthed]);

  const mistakeList = useMemo(() => Object.entries(mistakes)
    .filter(([, v]) => v.wrongCount >= 2 || v.manual)
    .map(([id, v]) => ({ id, q: questions.find((x) => x.id === id) ?? null, wrongCount: v.wrongCount, manual: v.manual }))
    .filter((e): e is { id: string; q: Question; wrongCount: number; manual: boolean } => !!e.q),
  [mistakes, questions]);

  const recordMistakes = (ids: string[]) => {
    if (!isAuthed || ids.length === 0) return;
    fetch("/api/mistakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.mistakes) return;
        setMistakes((prev) => {
          const n = { ...prev };
          (d.mistakes as Array<{ questionId: string; wrongCount: number; manual: boolean }>).forEach((row) => {
            n[row.questionId] = { wrongCount: row.wrongCount, manual: row.manual };
          });
          return n;
        });
      })
      .catch(() => {});
  };

  const addManualMistake = (id: string) => {
    if (!isAuthed) return;
    setMistakes((prev) => ({ ...prev, [id]: { wrongCount: prev[id]?.wrongCount ?? 0, manual: true } }));
    fetch("/api/mistakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: id, manual: true }) }).catch(() => {});
  };

  const deleteMistake = (id: string) => {
    setMistakes((prev) => { if (!prev[id]) return prev; const n = { ...prev }; delete n[id]; return n; });
    if (isAuthed) fetch(`/api/mistakes?questionId=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  };

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

  // saved-exam helpers — one paused exam per category key
  const buildRecord = (): SavedExam | null => {
    if (state !== "running" || quizQs.length === 0) return null;
    return { key: runLabel, tag: examTag, mode, minutes, ids: quizQs.map((q) => q.id), answers, optionOrder, idx, timeLeft, elapsed, updatedAt: Date.now() };
  };

  const liveRef = useRef<SavedExam | null>(null);
  useEffect(() => {
    liveRef.current = buildRecord();
  });

  // keep the running exam in localStorage if the tab closes / user navigates away (paid feature)
  useEffect(() => {
    return () => { if (accessRef.current && liveRef.current) writeLocalSavedExam(liveRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveExamNow = () => {
    // saving / pausing exams is a paid feature
    if (!accessRef.current) {
      setPaywallNote(true);
      return;
    }
    const rec = buildRecord();
    if (!rec) return;
    writeLocalSavedExam(rec);
    setSavedExams((prev) => ({ ...prev, [rec.key]: rec }));
    if (isAuthed) {
      fetch("/api/saved-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: rec.key, data: rec }) }).catch(() => {});
    }
  };

  const deleteSaved = (key: string) => {
    removeLocalSavedExam(key);
    setSavedExams((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    if (isAuthed) {
      fetch("/api/saved-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, data: null }) }).catch(() => {});
    }
  };

  const resume = (rec: SavedExam) => {
    const qs = rec.ids.map((id) => questions.find((x) => x.id === id)).filter((x): x is Question => !!x);
    if (qs.length === 0) return;
    if (!fullAccess && qs.some((q) => q.category !== FREE_CATEGORY)) {
      setPaywallNote(true);
      return;
    }
    setMode(rec.mode);
    setExamTag(rec.tag);
    setRunLabel(rec.key);
    setMinutes(rec.minutes);
    setQuizQs(qs);
    setAnswers(rec.answers || {});
    loadVotes(qs.map((q) => q.id));
    setOptionOrder(rec.optionOrder || {});
    setIdx(Math.min(rec.idx || 0, qs.length - 1));
    setTimeLeft(rec.timeLeft || 0);
    setElapsed(rec.elapsed || 0);
    setShowStudyFeedback(false);
    setConfirmExit(false);
    setPaused(false);
    setReviewFilter("review");
    setExpanded({});
    setState("running");
    window.scrollTo({ top: 0 });
  };

  const start = (o: { main?: string; sub?: string; n?: number; mins?: number; m?: Mode; tag?: string; ids?: string[] } = {}) => {
    if (!isAuthed) return;
    const mc = o.main ?? mainCategory;
    const sc = o.sub ?? subCategory;
    // paid categories are locked for unpaid users
    if (!o.ids && !fullAccess && mc !== "all" && mc !== FREE_CATEGORY) {
      setPaywallNote(true);
      return;
    }
    // main exam is paid-only for unpaid users
    if (!o.ids && !fullAccess && o.tag === "Үндсэн шалгалт") {
      setPaywallNote(true);
      return;
    }
    const nn = o.n ?? count;
    if (o.m) setMode(o.m);
    setExamTag(o.tag ?? null);
    const label = o.tag ?? (mc === "all" ? "all" : sc !== "all" ? `${mc} / ${sc}` : mc);
    setRunLabel(label);
    let pool = poolBase;
    if (o.ids) {
      // explicit question set (Их алддаг exam) — unpaid users keep free-category only
      const set = new Set(o.ids);
      pool = questions.filter((q) => set.has(q.id));
      if (!fullAccess) pool = pool.filter((q) => q.category === FREE_CATEGORY);
      if (pool.length === 0) {
        if (!fullAccess) setPaywallNote(true);
        return;
      }
    } else {
      if (mc !== "all") pool = pool.filter((q) => q.category === mc);
      if (sc !== "all") pool = pool.filter((q) => q.subCategory === sc);
      pool = applyQuery(pool);
    }
    deleteSaved(label);
    const picked = shuffle(pool).slice(0, Math.min(nn, pool.length));
    // 1 minute per question in exam mode; study mode is untimed
    const dur = (o.m ?? mode) === "study" ? 0 : o.mins ?? Math.max(picked.length, 1);
    const order: Record<string, number[]> = {};
    picked.forEach((q) => { order[q.id] = shuffle(q.options.map((_, oi) => oi)); });
    setOptionOrder(order);
    setQuizQs(picked);
    setAnswers({});
    loadVotes(picked.map((q) => q.id));
    setConfirmExit(false);
    setPaused(false);
    setSettingsOpen(false);
    setIdx(0);
    setMinutes(dur);
    setTimeLeft(dur * 60);
    setElapsed(0);
    setShowStudyFeedback(false);
    setState("running");
  };

  // exam with only the mistake-section questions
  const startMistakeExam = () => {
    const ids = mistakeList.map((m) => m.id);
    if (ids.length === 0) return;
    start({ tag: "Их алддаг", ids, n: ids.length, m: "exam", mins: ids.length });
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

  // no-answer questions in the picked subcategory (file-level) — for friendly judging text
  const subUnknowns = useMemo(() => {
    if (!subPair) return [];
    return questions.filter((q) => q.category === subPair.main && q.subCategory === subPair.sub && !fileHasAnswer(q));
  }, [questions, subPair]);
  useEffect(() => {
    if (subUnknowns.length === 0) return;
    loadVotes(subUnknowns.map((q) => q.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subPair]);
  const subUnsaved = subUnknowns.filter((q) => voteMy[q.id] === undefined && overrides[q.id] === undefined).length;

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

  // questions answered wrong in the current run (resolved answer only; auto-correct never wrong) — for mistake tracking
  const examWrongIds = () =>
    quizQs.filter((q) => {
      const a = answers[q.id];
      const j = judgeOf(q);
      return j.source !== "auto" && j.correct !== null && a !== undefined && a !== j.correct;
    }).map((q) => q.id);

  // timer
  useEffect(() => {
    if (state !== "running" || paused) return;
    if (minutes === 0) return; // no timer
    if (timeLeft <= 0) {
      const s = quizQs.reduce((acc, q) => {
        const a = answers[q.id];
        const j = judgeOf(q);
        if (j.source === "auto") return acc + 1;
        if (j.correct === null) return acc;
        return acc + (a === j.correct ? 1 : 0);
      }, 0);
      // study mode never saves statistics
      if (mode === "exam") saveAttempt({ category: runLabel, mode, score: s, total: quizQs.length, elapsed: minutes * 60, answers, questionIds: quizQs.map((q) => q.id) }, isAuthed);
      if (mode === "exam") recordMistakes(examWrongIds());
      deleteSaved(runLabel);
      setReviewFilter("review");
      setExpanded({});
      setState("result");
      return;
    }
    const id = setInterval(() => { setTimeLeft((t) => t - 1); setElapsed((e) => e + 1); }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, timeLeft, minutes, quizQs, answers, mode, isAuthed, runLabel, paused, judgeOf]);

  // also count elapsed when no timer
  useEffect(() => {
    if (state !== "running" || minutes !== 0 || paused) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [state, minutes, paused]);

  // ask permission on accidental reload/close during exam + autosave it
  useEffect(() => {
    if (state !== "running") return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      if (liveRef.current) writeLocalSavedExam(liveRef.current);
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [state]);

  const current = quizQs[idx];
  const total = quizQs.length;

  const score = useMemo(() => {
    let s = 0;
    quizQs.forEach((q) => {
      const a = answers[q.id];
      const j = judgeOf(q);
      if (j.source === "auto") s++;
      else if (j.correct !== null && a === j.correct) s++;
    });
    return s;
  }, [quizQs, answers, judgeOf]);

  // result dashboard stats: correct / wrong / unanswered / unknown
  const resultStats = useMemo(() => {
    let ok = 0, wrong = 0, un = 0, unk = 0;
    quizQs.forEach((q) => {
      const a = answers[q.id];
      const j = judgeOf(q);
      if (j.source === "auto") ok++;
      else if (j.correct === null) unk++;
      else if (a === undefined) un++;
      else if (a === j.correct) ok++;
      else wrong++;
    });
    return { ok, wrong, un, unk };
  }, [quizQs, answers, judgeOf]);

  // per main-category breakdown (unresolved unknown-answer questions excluded)
  const catBreakdown = useMemo(() => {
    const map = new Map<string, { ok: number; tot: number }>();
    quizQs.forEach((q) => {
      const j = judgeOf(q);
      if (j.correct === null && j.source !== "auto") return;
      const key = (q.category as string) || "Бусад";
      const e = map.get(key) ?? { ok: 0, tot: 0 };
      e.tot++;
      if (j.source === "auto") e.ok++;
      else if (answers[q.id] === j.correct) e.ok++;
      map.set(key, e);
    });
    return [...map.entries()].sort((a, b) => collator.compare(a[0], b[0]));
  }, [quizQs, answers, judgeOf, collator]);

  const submit = () => {
    // study mode never saves statistics
    if (mode === "exam") saveAttempt({ category: runLabel, mode, score, total, elapsed: minutes === 0 ? elapsed : minutes * 60 - timeLeft, answers, questionIds: quizQs.map((q) => q.id) }, isAuthed);
    if (mode === "exam") recordMistakes(examWrongIds());
    deleteSaved(runLabel);
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
    setPaused(false);
    setState("running");
    window.scrollTo({ top: 0 });
  };
  const backToSetup = () => {
    setState("setup");
    window.scrollTo({ top: 0 });
  };

  const letters = ["A", "B", "C", "D", "E"];
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (state === "setup" && sessionStatus === "loading") {
    return <div className="py-24 text-center text-[13px] text-zinc-400">Ачааллаж байна…</div>;
  }

  if (state === "setup" && !isAuthed) {
    return (
      <div className="mx-auto max-w-md w-full px-3 sm:px-0">
        <div className="rounded-xl sm:rounded-2xl border bg-white p-6 sm:p-8 text-center dark:bg-zinc-900 dark:border-zinc-800">
          <h1 className="text-[16px] sm:text-lg font-semibold">Шалгалт өгөхийн тулд нэвтэрнэ үү</h1>
          <p className="mt-1.5 text-[12px] sm:text-sm text-zinc-500">Шалгалт өгөх, дүн харах, үргэлжлүүлэх нь бүртгэлтэй хэрэглэгчид л боломжтой.</p>
          <Link href="/login" className="mt-5 flex w-full items-center justify-center rounded-full bg-zinc-900 py-2.5 text-[13px] sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 min-h-[40px]">
            Нэвтрэх →
          </Link>
        </div>
      </div>
    );
  }

  if (state === "setup") {
    const pool = (() => {
      let out = poolBase;
      if (mainCategory !== "all") out = out.filter((x) => x.category === mainCategory);
      if (subCategory !== "all") out = out.filter((x) => x.subCategory === subCategory);
      return applyQuery(out);
    })();
    const poolSize = pool.length;
    const settingsSummary = `${mainCategory === "all" ? "Бүх үндсэн" : mainCategory} · ${subCategory === "all" ? "Бүх дэд" : subCategory} · ${count} сорилго · ${mode === "exam" ? "Шалгалт" : "Сургалт"} · ${mode === "exam" ? `${Math.min(count, poolSize)} мин` : "Хязгааргүй"}`;
    return (
      <div className="mx-auto max-w-5xl w-full space-y-4 min-w-0 px-3 sm:px-0">
      <button onClick={() => (fullAccess ? setSettingsOpen(true) : setPaywallNote(true))} className="w-full rounded-xl sm:rounded-2xl border bg-white p-3.5 sm:p-5 dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden text-left hover:border-zinc-400 transition-colors min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="font-semibold text-[14px] sm:text-base truncate">{fullAccess ? "⚙" : "🔒"} Шалгалт тохиргоо</span>
          <span className="text-[11px] sm:text-xs text-zinc-500 shrink-0">Өөрчлөх →</span>
        </div>
        <p className="mt-1 text-[11px] sm:text-sm text-zinc-500 break-words leading-snug">{settingsSummary}</p>
        {!fullAccess && <p className="mt-1.5 text-[11px] sm:text-xs leading-snug text-zinc-400">🔒 Тохиргоо өөрчлөх нь Эрх авах төлөвлөгөөнд багтдаг — үнэгүй эрхээр дэд ангиллаар шалгалт өгнө.</p>}
      </button>
      {query.trim() && (
        <div className="flex items-center justify-between gap-2 rounded-xl sm:rounded-2xl border border-dashed bg-white px-3.5 py-2.5 sm:px-5 sm:py-3 dark:bg-zinc-900 dark:border-zinc-700">
          <p className="min-w-0 truncate text-[12px] sm:text-sm">Шүүлтүүр: “{query.trim()}” — {poolSize} сорилго</p>
          <button onClick={() => setQuery("")} className="shrink-0 rounded-full border px-3 py-1 text-[11px] sm:text-xs dark:border-zinc-700">Арилгах</button>
        </div>
      )}
      {lastExam && (
        <div className="flex items-center justify-between gap-2 rounded-xl sm:rounded-2xl border bg-white px-3.5 py-2.5 sm:px-5 sm:py-3 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-zinc-500">Сүүлийн шалгалт</p>
            <p className="truncate text-[12px] sm:text-sm font-medium">
              {lastExam.category} · {lastExam.score}/{lastExam.total}
              {lastExam.total > 0 ? ` (${Math.round((lastExam.score / lastExam.total) * 100)}%)` : ""}
              <span className="font-normal text-zinc-500"> · {new Date(lastExam.date).toLocaleString()}</span>
            </p>
          </div>
          <Link href="/history" className="shrink-0 rounded-full bg-zinc-900 px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
            Түүх →
          </Link>
        </div>
      )}

      {Object.keys(savedExams).length > 0 && (
        <div className="rounded-xl sm:rounded-2xl border border-dashed bg-white p-3 sm:p-4 dark:bg-zinc-900 dark:border-zinc-700">
          <p className="text-[11px] sm:text-xs font-medium text-zinc-500">⏸ Хадгалсан шалгалтууд</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:gap-2">
            {Object.values(savedExams)
              .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
              .slice(0, 4)
              .map((rec) => {
                const done = Object.keys(rec.answers || {}).length;
                const timeTxt = rec.minutes > 0 ? fmt(Math.max(rec.timeLeft, 0)) : `⏱ ${fmt(rec.elapsed || 0)}`;
                return (
                  <div key={rec.key} className="rounded-lg sm:rounded-xl border bg-zinc-50 px-3 py-2 dark:bg-zinc-800 dark:border-zinc-700 min-w-0">
                    <div className="min-w-0">
                      <p className="text-[12px] sm:text-sm font-medium break-words sm:truncate">{rec.tag ?? rec.key}</p>
                      <p className="text-[10px] sm:text-xs text-zinc-500">
                        {done}/{rec.ids.length} хариулсан · {timeTxt} · {rec.mode === "exam" ? "Шалгалт" : "Сургалт"}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <button onClick={() => resume(rec)} className="flex-1 min-w-0 rounded-full bg-zinc-900 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 truncate">
                        Үргэлжлүүлэх →
                      </button>
                      <button onClick={() => setPendingDeleteExam(rec.key)} aria-label="Устгах" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] text-zinc-500 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-700">✕</button>
                    </div>
                  </div>
                );
              })}
          </div>
          {Object.keys(savedExams).length > 4 && (
            <button onClick={() => setExamsModalOpen(true)} className="mt-2 w-full rounded-full border py-2 text-[12px] sm:text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 min-h-[36px]">
              +{Object.keys(savedExams).length - 4} илүү үзэх ↓
            </button>
          )}
        </div>
      )}

      {/* paywall notice (paid category / paid save action) */}
      {paywallNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="close" onClick={() => setPaywallNote(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <p className="text-3xl">🔒</p>
            <h3 className="mt-2 font-semibold text-[15px] sm:text-lg">Төлбөртэй эрх шаардлагатай</h3>
              <p className="mt-1 text-[12px] sm:text-sm text-zinc-500">Үндсэн шалгалт, шалгалт тохиргоо, бусад ангилал болон хадгалах нь 40,000₮-ийн бүтэн эрхэд багтдаг.</p>
              <Link href="/plan" className="mt-4 flex w-full items-center justify-center rounded-full bg-zinc-900 py-2.5 text-[13px] sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 min-h-[40px]">Эрх авах →</Link>
              <button onClick={() => setPaywallNote(false)} className="mt-2 w-full rounded-full border py-2.5 text-[13px] sm:text-sm dark:border-zinc-700 min-h-[40px]">Хаах</button>
            </div>
          </div>
        )}

      {/* confirm delete saved exam */}
      {pendingDeleteExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="close" onClick={() => setPendingDeleteExam(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <h3 className="font-semibold text-[14px] sm:text-base">Хадгалсан шалгалтыг устгах уу?</h3>
            <p className="mt-2 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">«{savedExams[pendingDeleteExam]?.tag ?? pendingDeleteExam}» устаж, буцаах боломжгүй болно.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPendingDeleteExam(null)} className="rounded-full border px-5 py-2 text-[13px] sm:text-sm dark:border-zinc-700 min-h-[36px]">Цуцлах</button>
              <button onClick={() => { deleteSaved(pendingDeleteExam); setPendingDeleteExam(null); }} className="rounded-full bg-zinc-900 px-5 py-2 text-[13px] sm:text-sm font-medium text-white dark:bg-white dark:text-zinc-900 min-h-[36px]">Устгах</button>
            </div>
          </div>
        </div>
      )}

      {/* all saved exams modal */}
      {examsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="close" onClick={() => setExamsModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md max-h-[80vh] overflow-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-[14px] sm:text-base">⏸ Хадгалсан шалгалтууд ({Object.keys(savedExams).length})</h3>
              <button onClick={() => setExamsModalOpen(false)} aria-label="Хаах" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] text-zinc-500 dark:border-zinc-700">✕</button>
            </div>
            <div className="mt-3 grid gap-1.5">
              {Object.values(savedExams)
                .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
                .map((rec) => {
                  const done = Object.keys(rec.answers || {}).length;
                  const timeTxt = rec.minutes > 0 ? fmt(Math.max(rec.timeLeft, 0)) : `⏱ ${fmt(rec.elapsed || 0)}`;
                  return (
                    <div key={rec.key} className="rounded-lg border bg-zinc-50 px-3 py-2 dark:bg-zinc-800 dark:border-zinc-700 min-w-0">
                      <div className="min-w-0">
                        <p className="text-[12px] sm:text-sm font-medium break-words">{rec.tag ?? rec.key}</p>
                        <p className="text-[10px] sm:text-xs text-zinc-500">
                          {done}/{rec.ids.length} хариулсан · {timeTxt} · {rec.mode === "exam" ? "Шалгалт" : "Сургалт"}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <button onClick={() => { setExamsModalOpen(false); resume(rec); }} className="flex-1 min-w-0 rounded-full bg-zinc-900 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 truncate">
                          Үргэлжлүүлэх →
                        </button>
                        <button onClick={() => setPendingDeleteExam(rec.key)} aria-label="Устгах" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] text-zinc-500 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-700">✕</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0 items-start">
      {settingsOpen && fullAccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <button aria-label="close" onClick={() => setSettingsOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl bg-white p-4 sm:p-8 shadow-xl dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-[16px] sm:text-2xl font-semibold break-words">Шалгалт тохиргоо</h1>
              <button onClick={() => setSettingsOpen(false)} aria-label="Хаах" className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border text-[13px] dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">✕</button>
            </div>
        

        <div className="mt-4 sm:mt-8 grid gap-4 sm:gap-6 min-w-0">
          <label className="grid gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[12px] sm:text-sm font-medium">Үндсэн ангилал</span>
            <select value={mainCategory} onChange={(e) => { setMainCategory(e.target.value); setSubCategory("all"); }} className="w-full min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]">
              <option value="all">Бүх үндсэн ({poolBase.length})</option>
              {mainCategories.map((c) => <option key={c} value={c}>{!fullAccess && c !== FREE_CATEGORY ? "🔒 " : ""}{c} ({questions.filter((q) => q.category === c).length})</option>)}
            </select>
          </label>
          {!fullAccess && mainCategory !== "all" && mainCategory !== FREE_CATEGORY && (
            <div className="rounded-lg sm:rounded-xl border border-dashed p-3 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400 dark:border-zinc-700">
              🔒 «{mainCategory}» нь төлбөртэй ангилал — <Link href="/plan" className="font-medium text-zinc-900 underline dark:text-white">Эрх авах</Link> үед нээгдэнэ. Үнэгүй: {FREE_CATEGORY}.
            </div>
          )}
          <label className="grid gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[12px] sm:text-sm font-medium">Дэд ангилал</span>
            <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)} className="w-full min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]">
              <option value="all">Бүх дэд ({mainCategory === "all" ? questions.length : questions.filter((q) => q.category === mainCategory).length})</option>
              {subCategories.map((c) => <option key={c} value={c}>{c} ({questions.filter((x) => (mainCategory === "all" || x.category === mainCategory) && x.subCategory === c).length})</option>)}
            </select>
          </label>

          <div className="grid gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[12px] sm:text-sm font-medium">Сорилгын тоо · {poolSize}</span>
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
                <button onClick={() => setMode("exam")} className={`flex-1 min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm min-h-[36px] sm:min-h-[48px] ${mode === "exam" ? "bg-zinc-900 text-white" : "dark:border-zinc-700"}`}>Шалгалт</button>
                <button onClick={() => { setMode("study"); setMinutes(0); }} className={`flex-1 min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm min-h-[36px] sm:min-h-[48px] ${mode === "study" ? "bg-zinc-900 text-white" : "dark:border-zinc-700"}`}>Сургалт</button>
              </div>
            </label>
            <div className={`grid gap-1.5 sm:gap-2 min-w-0 ${mode === "study" ? "opacity-50" : ""}`}>
              <span className="text-[12px] sm:text-sm font-medium">Хугацаа</span>
              <div className="w-full min-w-0 rounded-lg sm:rounded-xl border bg-zinc-50 px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800/60 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px] flex items-center text-zinc-500">
                {mode === "exam" ? `${Math.min(count, poolSize)} мин · 1 мин/сорилго` : "Хязгааргүй"}
              </div>
            </div>
          </div>

          <button onClick={() => start()} disabled={poolSize === 0} className="w-full rounded-full bg-zinc-900 py-2.5 sm:py-3 font-medium text-[13px] sm:text-base text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 min-h-[40px] sm:min-h-[48px]">
            Эхлэх — {Math.min(count, poolSize)} сорилго
          </button>
        </div>
          </div>
        </div>
      )}

      <div className="w-full min-w-0 rounded-xl sm:rounded-2xl border bg-white p-4 sm:p-8 dark:bg-zinc-900 dark:border-zinc-800">
        <h2 className="text-[14px] sm:text-xl font-semibold break-words">Дэд ангиллаар шалгалт</h2>

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
                          {savedExams[`${p.main} / ${p.sub}`] ? "⏸ " : ""}{p.sub} ({p.count})
                        </button>
                      ) : null)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {subPair && (subPair.main !== FREE_CATEGORY && !fullAccess ? (
          <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl border border-dashed p-4 text-center dark:border-zinc-700">
            <p className="text-2xl">🔒</p>
            <p className="mt-1 font-medium text-[13px] sm:text-sm">Төлбөртэй дэд ангилал</p>
            <p className="mt-1 text-[11px] sm:text-xs text-zinc-500">«{subPair.sub}»-аар шалгалт өгөх нь Эрх авах төлөвлөгөөнд багтдаг.</p>
            <Link href="/plan" className="mt-3 inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-2.5 text-[12px] sm:text-sm font-medium text-white dark:bg-white dark:text-zinc-900 min-h-[40px]">
              Эрх авах — 40,000₮ →
            </Link>
          </div>
        ) : (
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
            {subUnknowns.length > 0 && (
              <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl border border-dashed p-3 sm:p-4 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400 dark:border-zinc-700">
                <p className="font-medium text-zinc-900 dark:text-white">Та энэ дэд ангиллын {subUnknowns.length} хариултгүй сорилгоос {subUnsaved}-г нь хадгалаагүй байна.</p>
                <p className="mt-1">Хадгалаагүй сорилгыг хамгийн олон санал авсан сонголтоор дүгнэнэ. Хэн ч хадгалаагүй эсвэл санал тэнцсэн бол автоматаар зөв гэж үзнэ.</p>
                <p className="mt-1">Өөрийн хариултаа <Link href="/browse" className="font-medium text-zinc-900 underline dark:text-white">Бүх сорилго</Link> дээр хадгалж болно.</p>
              </div>
            )}
            <button
              onClick={() => { setMainCategory(subPair.main); setSubCategory(subPair.sub); setCount(subPair.count); setCustomCount(""); start({ main: subPair.main, sub: subPair.sub, n: subPair.count }); }}
              disabled={subPair.count === 0}
              className="mt-3 sm:mt-4 w-full rounded-full bg-zinc-900 py-2.5 sm:py-3 font-medium text-[13px] sm:text-base text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 min-h-[40px] sm:min-h-[48px]"
            >
              Эхлэх — бүх {subPair.count} сорилго
            </button>
          </div>
        ))}
      </div>

      {/* Их алддаг сорилгууд — always visible on setup; collapsed, questions hidden until tapped */}
      {mistakeList.length > 0 ? (
        <div className="w-full min-w-0 rounded-xl sm:rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden">
          <button onClick={() => setMistakesOpen((o) => !o)} className="w-full flex items-center justify-between gap-2 p-3.5 sm:p-5 text-left min-w-0 min-h-[48px]">
            <span className="font-semibold text-[14px] sm:text-base truncate">Их алддаг сорилгууд · {mistakeList.length}</span>
            <span className="shrink-0 text-[11px] sm:text-xs text-zinc-500">{mistakesOpen ? "Нуух ▾" : "Сорилгуудыг харах ▸"}</span>
          </button>
          {mistakesOpen && (
            <div className="px-3 pb-3 sm:px-4 sm:pb-4">
              <button onClick={startMistakeExam} className="w-full rounded-full bg-zinc-900 py-2.5 text-[13px] sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 min-h-[40px]">
                Эдгээрээр шалгалт өгөх →
              </button>
              <div className="mt-2 grid gap-1.5">
                {mistakeList.map(({ id, q, wrongCount, manual }) => (
                  <div key={id} className="flex items-center gap-2 rounded-lg border bg-zinc-50 px-2.5 py-2 dark:bg-zinc-800 dark:border-zinc-700 min-w-0">
                    <p className="flex-1 min-w-0 text-[12px] sm:text-sm leading-snug break-words line-clamp-2">{q.question}</p>
                    <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                      {wrongCount > 0 ? `✗ ${wrongCount}` : "гараар"}
                    </span>
                    <button onClick={() => deleteMistake(id)} aria-label="Устгах" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[12px] text-zinc-500 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-700">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full min-w-0 rounded-xl sm:rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 p-3.5 sm:p-5">
          <p className="font-semibold text-[14px] sm:text-base">Их алддаг сорилгууд</p>
          <p className="mt-1 text-[12px] sm:text-sm text-zinc-500">
            {isAuthed
              ? "Хоёр ба түүнээс дээш удаа алдсан сорилго энд гарна."
              : "Нэвтэрч орвол алдсан сорилгууд чинь энд цугларна."}
          </p>
        </div>
      )}

      <div className="w-full min-w-0 rounded-xl sm:rounded-2xl bg-zinc-950 border border-zinc-800 p-4 sm:p-8 text-white dark:bg-zinc-900 dark:border-zinc-700 overflow-hidden">
        <h2 className="text-[14px] sm:text-xl font-semibold break-words">Үндсэн шалгалт</h2>
        <p className="mt-1 text-[11px] sm:text-sm leading-snug text-zinc-300">Бодит шалгалтын форматаар — бүх сангаас 200 сорилго, 200 минут, шалгалтын горим. Үсэг нуугдаж, хариултууд холигдоно.</p>
        {!fullAccess && <p className="mt-1.5 text-[11px] sm:text-xs leading-snug text-zinc-400">🔒 Үндсэн шалгалт нь Эрх авах төлөвлөгөөнд багтдаг.</p>}
        <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
          <div className="rounded-lg bg-white/10 p-2 sm:p-3">
            <p className="text-[16px] sm:text-2xl font-bold leading-none">200</p>
            <p className="text-[10px] sm:text-xs text-zinc-300 mt-0.5">Сорилго</p>
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
        {!fullAccess ? (
          <button
            onClick={() => setPaywallNote(true)}
            className="mt-3 sm:mt-4 w-full rounded-full bg-white py-2.5 sm:py-3 font-semibold text-[13px] sm:text-base text-zinc-900 hover:bg-zinc-100 disabled:opacity-40 min-h-[40px] sm:min-h-[48px]"
          >
            🔒 Үндсэн шалгалт эхлэх
          </button>
        ) : (
          <button
            onClick={() => { setMainCategory("all"); setSubCategory("all"); setCount(200); setCustomCount(""); setMinutes(200); start({ main: "all", sub: "all", n: 200, mins: 200, m: "exam", tag: "Үндсэн шалгалт" }); }}
            disabled={questions.length === 0}
            className="mt-3 sm:mt-4 w-full rounded-full bg-white py-2.5 sm:py-3 font-semibold text-[13px] sm:text-base text-zinc-900 hover:bg-zinc-100 disabled:opacity-40 min-h-[40px] sm:min-h-[48px]"
          >
            Үндсэн шалгалт эхлэх
          </button>
        )}
      </div>
      </div>
      </div>
    );
  }

  if (state === "running" && current) {
    const ans = answers[current.id];
    const noFile = !fileHasAnswer(current);
    const judgeCur = judgeOf(current);
    const correct = noFile ? judgeCur.correct : fileAnswer(current);
    const isUnknown = noFile && judgeCur.source === "unknown";
    const isAuto = noFile && judgeCur.source === "auto";
    const answered = ans !== undefined;
    return (
      <div className="mx-auto max-w-3xl w-full space-y-3 sm:space-y-4 min-w-0 overflow-hidden px-3 sm:px-0 max-sm:min-h-[calc(100dvh-12rem)] max-sm:flex max-sm:flex-col max-sm:justify-center">
        <div className="rounded-xl sm:rounded-2xl border bg-white p-2.5 sm:p-4 flex items-center justify-between dark:bg-zinc-900 dark:border-zinc-800 gap-2 min-w-0 overflow-hidden">
          <span className="text-[12px] sm:text-sm font-medium shrink-0">{idx + 1} / {total}</span>
          <div className="h-1.5 sm:h-2 flex-1 mx-2 sm:mx-4 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full bg-zinc-900 dark:bg-white transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
          </div>
          {minutes > 0 ? <span className={`text-[12px] sm:text-sm font-mono shrink-0 ${timeLeft < 60 ? "text-red-600" : ""}`}>{fmt(timeLeft)}</span> : <span title="Зарцуулсан хугацаа" className="text-[12px] sm:text-sm font-mono shrink-0">⏱ {fmt(elapsed)}</span>}
          <button onClick={() => setPaused(true)} aria-label="Түр зогсоох" title="Түр зогсоох" className="shrink-0 inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border text-[12px] sm:text-sm dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">⏸</button>
          <button onClick={() => setConfirmExit(true)} aria-label="Шалгалт цуцлах" title="Шалгалт цуцлах" className="shrink-0 inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border text-[12px] sm:text-sm dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">✕</button>
        </div>

        {/* pause overlay: hides the question while timer is stopped */}
        {paused && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm dark:bg-zinc-950/95" />
            <div className="relative w-full max-w-sm rounded-2xl border bg-white p-6 text-center shadow-xl dark:bg-zinc-900 dark:border-zinc-800">
              <p className="text-3xl">⏸</p>
              <h3 className="mt-2 font-semibold text-[15px] sm:text-lg">Түр зогссон</h3>
              <p className="mt-1 text-[12px] sm:text-sm text-zinc-500">Хугацаа зогссон · {minutes > 0 ? fmt(timeLeft) : fmt(elapsed)}</p>
              <button onClick={() => setPaused(false)} className="mt-4 w-full rounded-full bg-zinc-900 py-2.5 text-[13px] sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 min-h-[40px]">Үргэлжлүүлэх ▶</button>
            </div>
          </div>
        )}

          <div className="rounded-xl sm:rounded-2xl border bg-white p-3 sm:p-6 dark:bg-zinc-900 dark:border-zinc-800 min-w-0 overflow-hidden">
          <h2 className="text-[14px] sm:text-lg font-medium leading-snug sm:leading-relaxed break-words [overflow-wrap:anywhere] min-w-0">{current.question}</h2>
          {noFile && <p className="mt-1.5 text-[11px] sm:text-xs rounded-full bg-amber-100 px-2 py-0.5 sm:px-3 sm:py-1 inline-block max-w-full break-words text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{isAuto ? "Хэн ч энэ сорилгыг хадгалаагүй эсвэл санал тэнцсэн — автоматаар зөв гэж үзнэ." : judgeCur.source === "personal" ? "Таны хадгалсан хариултаар дүгнэнэ." : judgeCur.source === "majority" ? "Хамгийн олон санал авсан сонголтоор дүгнэнэ." : "Зөв хариулт хараахан тодорхойгүй — Browse дээр хадгална уу"}</p>}

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
              {isAuto ? (
                <p className="text-[12px] sm:text-sm font-medium text-green-600 break-words">✓ Автоматаар зөв</p>
              ) : noFile && judgeCur.source !== "unknown" ? (
                !showStudyFeedback ? (
                  <button onClick={() => setShowStudyFeedback(true)} className="rounded-full border px-4 py-1.5 sm:px-5 sm:py-2 text-[12px] sm:text-sm dark:border-zinc-700 shrink-0">Хариу шалгах</button>
                ) : (
                  <p className={`text-[12px] sm:text-sm font-medium break-words min-w-0 ${ans === correct ? "text-green-600" : "text-red-600"}`}>{ans === correct ? "✓ Зөв!" : "✗ Буруу"}</p>
                )
              ) : isUnknown ? (
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

      {/* paywall notice (paid category / paid save action) */}
        {paywallNote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setPaywallNote(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-zinc-900 dark:border dark:border-zinc-800">
              <p className="text-3xl">🔒</p>
              <h3 className="mt-2 font-semibold text-[15px] sm:text-lg">Төлбөртэй эрх шаардлагатай</h3>
              <p className="mt-1 text-[12px] sm:text-sm text-zinc-500">Бусад ангиллаар шалгалт өгөх, хадгалах нь 40,000₮-ийн бүтэн эрхэд багтдаг.</p>
              <Link href="/plan" className="mt-4 flex w-full items-center justify-center rounded-full bg-zinc-900 py-2.5 text-[13px] sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 min-h-[40px]">Эрх авах →</Link>
              <button onClick={() => setPaywallNote(false)} className="mt-2 w-full rounded-full border py-2.5 text-[13px] sm:text-sm dark:border-zinc-700 min-h-[40px]">Хаах</button>
            </div>
          </div>
        )}

        {/* confirm exit exam (save & continue later) */}
        {confirmExit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setConfirmExit(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-zinc-900 dark:border dark:border-zinc-800">
              {!fullAccess ? (
                <>
                  <h3 className="font-semibold text-[14px] sm:text-base">🔒 Хадгалах нь төлбөртэй</h3>
                  <p className="mt-2 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">Шалгалт түр зогсоож, үргэлжлүүлэх нь Эрх авах төлөвлөгөөнд багтдаг.</p>
                  <div className="mt-4 grid gap-2">
                    <Link href="/plan" className="flex w-full items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-[13px] sm:text-sm font-medium text-white dark:bg-white dark:text-zinc-900 min-h-[40px]">Эрх авах — 40,000₮ →</Link>
                    <button onClick={() => { setConfirmExit(false); setShowStudyFeedback(false); setState("setup"); }} className="rounded-full border px-5 py-2 text-[13px] sm:text-sm dark:border-zinc-700 min-h-[36px]">Хадгалахгүй гарах</button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-[14px] sm:text-base">Шалгалтыг түр зогсоох уу?</h3>
                  <p className="mt-2 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">Хариултууд хадгалагдаж, явсан газраасаа үргэлжлүүлнэ.</p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => setConfirmExit(false)} className="rounded-full border px-5 py-2 text-[13px] sm:text-sm dark:border-zinc-700 min-h-[36px]">Үргэлжлүүлэх</button>
                    <button onClick={() => { saveExamNow(); setConfirmExit(false); setShowStudyFeedback(false); setState("setup"); }} className="rounded-full bg-zinc-900 px-5 py-2 text-[13px] sm:text-sm font-medium text-white dark:bg-white dark:text-zinc-900 min-h-[36px]">Хадгалах</button>
                  </div>
                </>
              )}
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
    const j = judgeOf(q);
    if (j.source === "auto") return "correct" as const;
    if (j.correct === null) return "unknown" as const;
    if (a === undefined) return "unanswered" as const;
    return a === j.correct ? ("correct" as const) : ("wrong" as const);
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
          const j = judgeOf(q);
          const c = j.correct;
          const unknown = st === "unknown";
          const auto = j.source === "auto";
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
                  <p className="text-[10px] sm:text-xs text-zinc-500 break-words">{q.category}{q.subCategory ? ` · ${q.subCategory}` : ""} {unknown ? "· хариултгүй" : auto ? "· Автоматаар зөв" : j.source === "majority" ? "· Олонхын санал" : j.source === "personal" ? "· Та хадгалсан" : ""} {st === "unanswered" ? "· хариулаагүй" : ""}</p>
                  <div className="mt-2 grid gap-1.5 sm:gap-2 min-w-0">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className={`rounded-lg sm:rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 text-[12px] sm:text-sm flex gap-1.5 sm:gap-2 min-w-0 overflow-hidden ${!unknown && !auto && oi === c ? "border-green-500 bg-green-100 dark:bg-green-900" : ""} ${oi === a && !ok && !unknown && !auto ? "border-red-500 bg-red-100 dark:bg-red-900" : "bg-white dark:bg-zinc-800"}`}>
                        <span className="font-bold shrink-0">{letters[oi]}.</span><span className="flex-1 min-w-0 break-words [overflow-wrap:anywhere] leading-snug">{opt} {!unknown && !auto && oi === c && "✓"} {!unknown && !auto && oi === c && j.source === "personal" && <span className="text-[10px]">· Та хадгалсан</span>} {oi === a && oi !== c && !unknown && !auto && "← таны сонголт"}</span>
                      </div>
                    ))}
                  </div>
                  {isAuthed && (st === "wrong" || st === "unanswered") && (
                    mistakes[q.id] && (mistakes[q.id].wrongCount >= 2 || mistakes[q.id].manual)
                      ? <p className="mt-2 text-[11px] sm:text-xs text-zinc-500">✓ Их алддагт нэмэгдсэн{mistakes[q.id].wrongCount > 0 ? ` · ✗ ${mistakes[q.id].wrongCount}` : ""}</p>
                      : <button onClick={() => addManualMistake(q.id)} className="mt-2 rounded-full border px-3 py-1.5 text-[11px] sm:text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 min-h-[36px]">+ Их алддагт нэмэх</button>
                  )}
                  {unknown && <p className="mt-1.5 text-[11px] sm:text-xs text-zinc-500 break-words">Зөв хариулт хараахан тодорхойгүй — Browse дээр A–D сонгоод хадгална уу.</p>}
                  {auto && <p className="mt-1.5 text-[11px] sm:text-xs text-zinc-500 break-words">Хэн ч хадгалаагүй эсвэл санал тэнцсэн — автоматаар зөв гэж үзсэн.</p>}
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
