"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Question } from "@/types/question";
import { fileAnswer } from "@/lib/voteJudge";
import { readLocalSavedExams, writeLocalSavedExam, removeLocalSavedExam, type SavedExam } from "@/lib/savedExams";
import { FREE_CATEGORY } from "@/lib/access";
import DropSelect from "@/components/DropSelect";
import { indexMainName, indexSubName, type IndexData, type IndexRow } from "@/lib/questionIndex";
import { fetchQuestionsByIds } from "@/lib/fetchQuestionsByIds";
import QuestionReport from "@/components/QuestionReport";

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

export default function QuizClient({ index }: { index: IndexData }) {
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const isAuthed = !!session?.user;
  const userId = (session?.user as unknown as { id?: string } | undefined)?.id ?? null;
  const fullAccess =
    (session?.user as unknown as { hasPaid?: boolean; role?: string } | undefined)?.hasPaid === true ||
    (session?.user as unknown as { role?: string } | undefined)?.role === "ADMIN";
  // unpaid users only get the free category in exam pools (lists stay visible)
  const [paywallNote, setPaywallNote] = useState(false);
  const accessRef = useRef(true);
  accessRef.current = fullAccess;
  const userRef = useRef<string | null>(null);
  userRef.current = userId;
  const collator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }), []);

  // question index rows replace the old full-bank prop; full question data is fetched by id on demand
  const [items, setItems] = useState<Record<string, Question>>({});
  const itemsRef = useRef<Record<string, Question>>({});
  const mergeItems = useCallback((list: Question[]) => {
    if (list.length === 0) return;
    const next = { ...itemsRef.current };
    for (const q of list) next[q.id] = q;
    itemsRef.current = next;
    setItems(next);
  }, []);
  const fetchItems = useCallback(
    async (ids: string[]): Promise<Question[]> => {
      const uniq = [...new Set(ids)].filter(Boolean);
      const need = uniq.filter((id) => !itemsRef.current[id]);
      if (need.length > 0) {
        mergeItems(await fetchQuestionsByIds(need));
      }
      return uniq.map((id) => itemsRef.current[id]).filter((q): q is Question => !!q);
    },
    [mergeItems]
  );
  const rowById = useMemo(() => new Set(index.rows.map((r) => r[0])), [index]);
  const freeIdx = useMemo(() => index.mains.findIndex((m) => m.name === FREE_CATEGORY), [index]);
  const baseRows = useMemo(
    () => (fullAccess || freeIdx < 0 ? index.rows : index.rows.filter((r) => r[1] === freeIdx)),
    [index, fullAccess, freeIdx]
  );
  const rowsByMain = useMemo(() => {
    const map: IndexRow[][] = index.mains.map(() => []);
    for (const r of index.rows) if (r[1] >= 0) map[r[1]].push(r);
    return map;
  }, [index]);
  const mainCategories = useMemo(() => index.mains.map((m) => m.name), [index]);
  // pre-filter from /browse practice link: ?main=&sub=&q=&type=
  const [mainCategory, setMainCategory] = useState<string>(() => {
    const m = searchParams.get("main");
    return m && index.mains.some((x) => x.name === m) ? m : "all";
  });
  const [subCategory, setSubCategory] = useState<string>(() => searchParams.get("sub") || "all");
  const [query, setQuery] = useState<string>(() => searchParams.get("q") || "");
  const [qtype, setQtype] = useState<"all" | "case" | "knowledge">(() => {
    const t = searchParams.get("type");
    return t === "case" || t === "knowledge" ? t : "all";
  });
  const [queryIds, setQueryIds] = useState<Set<string> | null>(null);
  const subCategories = useMemo(() => {
    if (mainCategory === "all") return index.allSubs.map((s) => s.name);
    const i = index.mains.findIndex((m) => m.name === mainCategory);
    return i >= 0 ? index.mains[i].subs.map((s) => s.name) : [];
  }, [index, mainCategory]);
  // my saved answers (DB) — a personal saved answer counts as right in exams
  const [savedAnswers, setSavedAnswers] = useState<Record<string, number>>({});
  const correctOf = useCallback(
    (q: Question): number | null => {
      const mine = savedAnswers[q.id];
      if (typeof mine === "number" && Number.isInteger(mine) && mine >= 0 && mine < q.options.length) return mine;
      return fileAnswer(q);
    },
    [savedAnswers]
  );

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    fetch("/api/saved-answers?mine=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.my) setSavedAnswers((p) => ({ ...d.my, ...p })); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthed]);

  const [state, setState] = useState<QuizState>("setup");
  const [preparing, setPreparing] = useState(false);
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
  const [runMode, setRunMode] = useState<Mode>("exam");
  const [minutes, setMinutes] = useState(20);

  const [quizQs, setQuizQs] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [optionOrder, setOptionOrder] = useState<Record<string, number[]>>({});
  const [showStudyFeedback, setShowStudyFeedback] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [pendingDeleteExam, setPendingDeleteExam] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [setupTab, setSetupTab] = useState<"exam" | "saved" | "mistakes">("exam");
  const [savedPage, setSavedPage] = useState(1);
  const [mistakePage, setMistakePage] = useState(1);
  const [navOpen, setNavOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const [elapsed, setElapsed] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<"review" | "all" | "correct">("review");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [examTag, setExamTag] = useState<string | null>(null);
  const [runLabel, setRunLabel] = useState<string>("all");
  const [savedExams, setSavedExams] = useState<Record<string, SavedExam>>({});
  const [mistakes, setMistakes] = useState<Record<string, { wrongCount: number; manual: boolean }>>({});

  // load saved (paused) exams: local always, DB merge when authed
  useEffect(() => {
    if (state !== "setup") return;
    const local = readLocalSavedExams(userId);
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
  }, [state, isAuthed, userId]);

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
    .filter(([id]) => rowById.has(id))
    .map(([id, v]) => ({ id, wrongCount: v.wrongCount, manual: v.manual })),
  [mistakes, rowById]);
  // keep the texts of the mistake questions cached for the setup card + modal
  const mistakeIds = mistakeList.map((m) => m.id);
  const mistakeIdsKey = mistakeIds.join("\u0001");
  useEffect(() => {
    if (mistakeIds.length) void fetchItems(mistakeIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mistakeIdsKey, fetchItems]);

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

  // text pre-filter from /browse (?q=): rows carry no text, so resolve matching ids on the server
  const filterIds = useCallback(async (text: string): Promise<Set<string>> => {
    const s = text.trim();
    if (!s) return new Set();
    try {
      const r = await fetch(`/api/questions?filter=1&by=qo&q=${encodeURIComponent(s)}`);
      if (!r.ok) return new Set();
      const d = await r.json();
      return new Set<string>(d?.ids || []);
    } catch { return new Set(); }
  }, []);
  useEffect(() => {
    const s = query.trim();
    if (!s) { setQueryIds(null); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      filterIds(s).then((ids) => { if (!cancelled) setQueryIds(ids); });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, filterIds]);

  // drop invalid ?sub= once real subcategory list is known
  useEffect(() => {
    if (subCategory !== "all" && !subCategories.includes(subCategory)) setSubCategory("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subCategories]);

  // exams only use questions with an official answer — keep category selections valid
  useEffect(() => {
    if (state !== "setup") return;
    if (mainCategory !== "all") {
      const mi = index.mains.findIndex((m) => m.name === mainCategory);
      if (mi < 0 || !rowsByMain[mi].some((r) => r[3] === 1)) { setMainCategory("all"); setSubCategory("all"); return; }
    }
    if (subCategory !== "all") {
      const mi = index.mains.findIndex((m) => m.name === mainCategory);
      const rows = mi >= 0 ? rowsByMain[mi] : index.rows;
      if (!rows.some((r) => indexSubName(index, r) === subCategory && r[3] === 1)) setSubCategory("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainCategory, subCategory, index, rowsByMain, state]);

  // saved-exam helpers — one paused exam per category key
  const buildRecord = (): SavedExam | null => {
    if (state !== "running" || quizQs.length === 0) return null;
    return { key: runLabel, tag: examTag, mode: runMode, minutes, ids: quizQs.map((q) => q.id), answers, optionOrder, idx, timeLeft, elapsed, updatedAt: Date.now() };
  };

  const liveRef = useRef<SavedExam | null>(null);
  useEffect(() => {
    liveRef.current = buildRecord();
  });

  // keep the running exam in localStorage if the tab closes / user navigates away (paid feature)
  useEffect(() => {
    return () => { if (accessRef.current && liveRef.current) writeLocalSavedExam(liveRef.current, userRef.current); };
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
    writeLocalSavedExam(rec, userRef.current);
    setSavedExams((prev) => ({ ...prev, [rec.key]: rec }));
    if (isAuthed) {
      fetch("/api/saved-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: rec.key, data: rec }) }).catch(() => {});
    }
  };

  const deleteSaved = (key: string) => {
    removeLocalSavedExam(key, userRef.current);
    setSavedExams((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    if (isAuthed) {
      fetch("/api/saved-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, data: null }) }).catch(() => {});
    }
  };

  const resume = (rec: SavedExam) => {
    const known = rec.ids.filter((id) => rowById.has(id));
    if (known.length === 0) return;
    setPreparing(true);
    fetchItems(known)
      .then((qs) => {
        if (qs.length === 0) return;
        if (!fullAccess && qs.some((q) => q.category !== FREE_CATEGORY)) {
          setPaywallNote(true);
          return;
        }
        setRunMode(rec.mode);
        setExamTag(rec.tag);
        setRunLabel(rec.key);
        setMinutes(rec.minutes);
        setQuizQs(qs);
        setAnswers(rec.answers || {});
        setOptionOrder(rec.optionOrder || {});
        setIdx(Math.min(rec.idx || 0, qs.length - 1));
        setTimeLeft(rec.timeLeft || 0);
        setElapsed(rec.elapsed || 0);
        setShowStudyFeedback(false);
        setConfirmExit(false);
        setPaused(false);
        setReviewFilter("review");
        setExpanded({});
        setNavOpen(false);
        setState("running");
        window.scrollTo({ top: 0 });
      })
      .finally(() => setPreparing(false));
  };

  const start = async (o: { main?: string; sub?: string; n?: number; mins?: number; m?: Mode; tag?: string; ids?: string[] } = {}) => {
    if (!isAuthed || preparing) return;
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
    const rm = o.m ?? mode;
    const qstr = query.trim();
    setRunMode(rm);
    setExamTag(o.tag ?? null);
    let rows: IndexRow[];
    if (o.ids) {
      // explicit question set (Их алддаг exam) — unpaid users keep free-category only
      const set = new Set(o.ids);
      rows = index.rows.filter((r) => set.has(r[0]));
      if (!fullAccess) rows = rows.filter((r) => r[1] === freeIdx);
      rows = rows.filter((r) => r[3] === 1);
      if (rows.length === 0) {
        if (!fullAccess) setPaywallNote(true);
        return;
      }
    } else {
      rows = baseRows;
      if (mc !== "all") {
        const mi = index.mains.findIndex((m) => m.name === mc);
        rows = mi >= 0 ? rows.filter((r) => r[1] === mi) : [];
      }
      if (sc !== "all") rows = rows.filter((r) => indexSubName(index, r) === sc);
      rows = rows.filter((r) => r[3] === 1);
      if (qtype !== "all") rows = rows.filter((r) => (r[4] === 1) === (qtype === "case"));
      if (qstr) {
        const ids = await filterIds(qstr);
        rows = rows.filter((r) => ids.has(r[0]));
      }
    }
    const total = Math.min(nn, rows.length);
    const base = o.tag ?? (mc === "all" ? "all" : sc !== "all" ? `${mc} / ${sc}` : mc);
    const filters = [
      qtype !== "all" ? (qtype === "case" ? "Кейс" : "Онол") : null,
      o.tag ? null : rm === "study" ? "Сургалт" : "Шалгалт",
      o.tag ? null : `${total} сорилго`,
      qstr && !o.tag ? `Шүүлтүүр: ${qstr}` : null,
    ].filter(Boolean).join(" · ");
    const label = filters && !o.tag ? `${base} · ${filters}` : base;
    setRunLabel(label);
    deleteSaved(label);
    const pickedRows = shuffle(rows).slice(0, total);
    if (pickedRows.length === 0) return;
    setPreparing(true);
    let picked: Question[] = [];
    try {
      picked = await fetchItems(pickedRows.map((r) => r[0]));
    } finally {
      setPreparing(false);
    }
    if (picked.length === 0) return;
    // 1 minute per question in exam mode; study mode is untimed
    const dur = rm === "study" ? 0 : o.mins ?? Math.max(picked.length, 1);
    const order: Record<string, number[]> = {};
    picked.forEach((q) => { order[q.id] = shuffle(q.options.map((_, oi) => oi)); });
    setOptionOrder(order);
    setQuizQs(picked);
    setAnswers({});
    setConfirmExit(false);
    setPaused(false);
    setSettingsOpen(false);
    setNavOpen(false);
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

  // quick exam picker — officially answered questions only, 0-count subs never show
  const subPairs = useMemo(() => {
    const answered = new Map<string, number>();
    for (const r of index.rows) {
      if (r[3] !== 1) continue;
      const key = `${r[1]}\u0001${r[2]}`;
      answered.set(key, (answered.get(key) ?? 0) + 1);
    }
    const out: Array<{ main: string; sub: string; count: number; label: string }> = [];
    index.mains.forEach((m, mi) => {
      m.subs.forEach((s, si) => {
        const n = answered.get(`${mi}\u0001${si}`) ?? 0;
        if (n > 0) out.push({ main: m.name, sub: s.name, count: n, label: `${m.name} / ${s.name}` });
      });
    });
    return out.sort((a, b) => collator.compare(a.main, b.main) || collator.compare(a.sub, b.sub));
  }, [index, collator]);

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

  // Desktop (lg: 3 columns) exam sections: pin the first two cards to the
  // main-exam card's height so all three match, without one card's expansion
  // stretching the others (the grid is items-start, so nothing stretches).
  const secARef = useRef<HTMLButtonElement | null>(null);
  const secBRef = useRef<HTMLDivElement | null>(null);
  const secCRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (setupTab !== "exam") return;
    const pin = () => {
      const a = secARef.current, b = secBRef.current, c = secCRef.current;
      if (!a || !b || !c) return;
      a.style.minHeight = "";
      b.style.minHeight = "";
      if (window.innerWidth < 1024) return;
      const h = c.offsetHeight;
      if (h > 0) {
        a.style.minHeight = `${h}px`;
        b.style.minHeight = `${h}px`;
      }
    };
    pin();
    const t = window.setTimeout(pin, 350);
    window.addEventListener("resize", pin);
    return () => { window.removeEventListener("resize", pin); window.clearTimeout(t); };
  }, [setupTab, fullAccess, mainExamStats]);

  // questions answered wrong in the current run — for mistake tracking
  const examWrongIds = () =>
    quizQs.filter((q) => {
      const a = answers[q.id];
      const c = correctOf(q);
      return c !== null && a !== undefined && a !== c;
    }).map((q) => q.id);

  // timer
  useEffect(() => {
    if (state !== "running" || paused) return;
    if (minutes === 0) return; // no timer
    if (timeLeft <= 0) {
      const s = quizQs.reduce((acc, q) => {
        const a = answers[q.id];
        const c = correctOf(q);
        if (c === null) return acc;
        return acc + (a === c ? 1 : 0);
      }, 0);
      // study mode never saves statistics
      if (runMode === "exam") saveAttempt({ category: runLabel, mode: runMode, score: s, total: quizQs.length, elapsed: minutes * 60, answers, questionIds: quizQs.map((q) => q.id) }, isAuthed);
      if (runMode === "exam") recordMistakes(examWrongIds());
      deleteSaved(runLabel);
      setReviewFilter("review");
      setExpanded({});
      setState("result");
      return;
    }
    const id = setInterval(() => { setTimeLeft((t) => t - 1); setElapsed((e) => e + 1); }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, timeLeft, minutes, quizQs, answers, runMode, isAuthed, runLabel, paused, correctOf]);

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
      if (liveRef.current) writeLocalSavedExam(liveRef.current, userRef.current);
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [state]);

  // question-nav modal: close on Escape
  useEffect(() => {
    if (!navOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setNavOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [navOpen]);

  const current = quizQs[idx];
  const total = quizQs.length;

  const score = useMemo(() => {
    let s = 0;
    quizQs.forEach((q) => {
      const c = correctOf(q);
      if (c !== null && answers[q.id] === c) s++;
    });
    return s;
  }, [quizQs, answers, correctOf]);

  // result dashboard stats: correct / wrong / unanswered / unknown
  const resultStats = useMemo(() => {
    let ok = 0, wrong = 0, un = 0, unk = 0;
    quizQs.forEach((q) => {
      const a = answers[q.id];
      const c = correctOf(q);
      if (c === null) unk++;
      else if (a === undefined) un++;
      else if (a === c) ok++;
      else wrong++;
    });
    return { ok, wrong, un, unk };
  }, [quizQs, answers, correctOf]);

  // per main-category breakdown (questions with no official answer excluded)
  const catBreakdown = useMemo(() => {
    const map = new Map<string, { ok: number; tot: number }>();
    quizQs.forEach((q) => {
      const c = correctOf(q);
      if (c === null) return;
      const key = (q.category as string) || "Бусад";
      const e = map.get(key) ?? { ok: 0, tot: 0 };
      e.tot++;
      if (answers[q.id] === c) e.ok++;
      map.set(key, e);
    });
    return [...map.entries()].sort((a, b) => collator.compare(a[0], b[0]));
  }, [quizQs, answers, correctOf, collator]);

  const submit = () => {
    // study mode never saves statistics
    if (runMode === "exam") saveAttempt({ category: runLabel, mode: runMode, score, total, elapsed: minutes === 0 ? elapsed : minutes * 60 - timeLeft, answers, questionIds: quizQs.map((q) => q.id) }, isAuthed);
    if (runMode === "exam") recordMistakes(examWrongIds());
    deleteSaved(runLabel);
    setReviewFilter("review");
    setExpanded({});
    setNavOpen(false);
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
    setNavOpen(false);
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
    return <div className="py-24 text-center text-[13px] text-zinc-400 min-h-[100vh]">Ачааллаж байна…</div>;
  }

  if (state === "setup" && !isAuthed) {
    return (
      <div className="mx-auto max-w-md w-full px-3 sm:px-0 min-h-[100vh]">
        <div className="rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 text-center dark:border-white/10 dark:bg-white/[0.04]">
          <h1 className="text-[16px] sm:text-lg font-semibold">Шалгалт өгөхийн тулд нэвтэрнэ үү</h1>
          <p className="mt-1.5 text-[12px] sm:text-sm text-zinc-500">Шалгалт өгөх, дүн харах, үргэлжлүүлэх нь бүртгэлтэй хэрэглэгчид л боломжтой.</p>
          <Link href="/login" className="mt-5 flex w-full items-center justify-center rounded-full bg-indigo-600 py-2.5 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px]">
            Нэвтрэх →
          </Link>
        </div>
      </div>
    );
  }

  if (state === "setup") {
    const poolRows = (() => {
      let out = baseRows;
      if (mainCategory !== "all") {
        const mi = index.mains.findIndex((m) => m.name === mainCategory);
        out = mi >= 0 ? out.filter((r) => r[1] === mi) : [];
      }
      if (subCategory !== "all") out = out.filter((r) => indexSubName(index, r) === subCategory);
      out = out.filter((r) => r[3] === 1);
      if (qtype !== "all") out = out.filter((r) => (r[4] === 1) === (qtype === "case"));
      if (queryIds) out = out.filter((r) => queryIds.has(r[0]));
      return out;
    })();
    const poolSize = poolRows.length;
    const examCountRows = (rows: IndexRow[]) => rows.filter((r) => r[3] === 1).length;
    const labelMainIdx = mainCategory === "all" ? -1 : index.mains.findIndex((m) => m.name === mainCategory);
    const labelMainRows = labelMainIdx < 0 ? index.rows : rowsByMain[labelMainIdx] ?? [];
    const savedList = Object.values(savedExams).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const savedTotalPages = Math.max(1, Math.ceil(savedList.length / 6));
    const savedPageClamped = Math.min(savedPage, savedTotalPages);
    const savedSlice = savedList.slice((savedPageClamped - 1) * 6, savedPageClamped * 6);
    const mistakeTotalPages = Math.max(1, Math.ceil(mistakeList.length / 6));
    const mistakePageClamped = Math.min(mistakePage, mistakeTotalPages);
    const mistakeSlice = mistakeList.slice((mistakePageClamped - 1) * 6, mistakePageClamped * 6);
    return (
      <div className="mx-auto max-w-5xl w-full space-y-4 min-w-0 px-3 sm:px-0 min-h-[100vh]">
      <div className="relative overflow-hidden pt-1 sm:pt-3">
        <div aria-hidden className="pointer-events-none absolute -top-10 -right-16 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/20" />
        <div aria-hidden className="pointer-events-none absolute -top-6 right-24 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-500/20" />
        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Lexlab · Бэлтгэл</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">Шалгалт</h1>
            <p className="mt-1 text-[12px] sm:text-sm text-zinc-500">Ангилал, сорилгын тоо, горимоо сонгоод бэлдэж эхлээрэй.</p>
          </div>
          <div className="hidden sm:flex shrink-0 items-center gap-2.5 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <span className="text-xl font-extrabold tabular-nums leading-none text-indigo-600 dark:text-indigo-300">{examCountRows(index.rows)}</span>
            <span className="text-[11px] leading-tight text-zinc-500">бэлэн<br />сорилго</span>
          </div>
        </div>
      </div>
      <div className="sticky top-0 sm:top-[61px] z-20 -mx-3 bg-white/90 px-3 py-2 backdrop-blur-xl dark:bg-[#07070c]/85 sm:mx-0 sm:rounded-2xl sm:border sm:border-zinc-200 sm:bg-white/95 sm:px-2 sm:py-2 sm:dark:border-white/10 sm:dark:bg-[#0c0c14]/90">
        <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5">
          <button onClick={() => setSetupTab("exam")} className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] sm:text-xs font-medium min-h-[32px] sm:min-h-[36px] transition-colors ${setupTab === "exam" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"}`}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M9.5 15.5v-7l6 3.5-6 3.5Z" /></svg>
            Шалгалт
          </button>
          <button onClick={() => setSetupTab("saved")} className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] sm:text-xs font-medium min-h-[32px] sm:min-h-[36px] transition-colors ${setupTab === "saved" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"}`}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="6" y="4" width="4" height="16" rx="1.5" /><rect x="14" y="4" width="4" height="16" rx="1.5" /></svg>
            Хадгалсан
            {Object.keys(savedExams).length > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold tabular-nums ${setupTab === "saved" ? "bg-white/25" : "bg-zinc-200 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"}`}>{Object.keys(savedExams).length}</span>}
          </button>
          <button onClick={() => setSetupTab("mistakes")} className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] sm:text-xs font-medium min-h-[32px] sm:min-h-[36px] transition-colors ${setupTab === "mistakes" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"}`}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            Их алддаг
            {mistakeList.length > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold tabular-nums ${setupTab === "mistakes" ? "bg-white/25" : "bg-zinc-200 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"}`}>{mistakeList.length}</span>}
          </button>
        </div>
      </div>
      {setupTab === "exam" && (
      <>
      {query.trim() && (
        <div className="flex items-center justify-between gap-2 rounded-xl sm:rounded-2xl border border-dashed border-zinc-200 bg-white px-3.5 py-2.5 sm:px-5 sm:py-3 dark:border-white/15 dark:bg-white/[0.04]">
          <p className="min-w-0 truncate text-[12px] sm:text-sm">Шүүлтүүр: “{query.trim()}” — {poolSize} сорилго</p>
          <button onClick={() => setQuery("")} className="shrink-0 rounded-full border border-zinc-200 px-3 py-1 text-[11px] sm:text-xs dark:border-white/15">Арилгах</button>
        </div>
      )}
      {lastExam && (
        <div className="flex items-center justify-between gap-2 rounded-xl sm:rounded-2xl border border-zinc-200 bg-white px-3.5 py-2.5 sm:px-5 sm:py-3 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-zinc-500">Сүүлийн шалгалт</p>
            <p className="truncate text-[12px] sm:text-sm font-medium">
              {lastExam.category} · {lastExam.score}/{lastExam.total}
              {lastExam.total > 0 ? ` (${Math.round((lastExam.score / lastExam.total) * 100)}%)` : ""}
              <span className="font-normal text-zinc-500"> · {new Date(lastExam.date).toLocaleString()}</span>
            </p>
          </div>
          <Link href="/history" className="shrink-0 rounded-full bg-indigo-600 px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400">
            Түүх →
          </Link>
        </div>
      )}

      </>)}

      {setupTab === "saved" && (
      <>
      {Object.keys(savedExams).length > 0 ? (
        <>
        <div className="grid gap-3 sm:grid-cols-2 items-stretch min-w-0">
          {savedSlice.map((rec) => {
              const done = Object.keys(rec.answers || {}).length;
              const timeTxt = rec.minutes > 0 ? fmt(Math.max(rec.timeLeft, 0)) : `⏱ ${fmt(rec.elapsed || 0)}`;
              const pct = rec.ids.length ? Math.round((done / rec.ids.length) * 100) : 0;
              return (
                <div key={rec.key} className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04] min-w-0">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <p className="min-w-0 text-[14px] sm:text-[15px] font-semibold break-words line-clamp-2">{rec.tag ?? rec.key}</p>
                    <button onClick={() => setPendingDeleteExam(rec.key)} aria-label="Устгах" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-[13px] text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:border-white/15 dark:hover:bg-rose-400/10 dark:hover:text-rose-400">✕</button>
                  </div>
                  <span className="mt-1.5 inline-flex w-fit items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-zinc-600 dark:bg-white/10 dark:text-zinc-300">{rec.mode === "exam" ? "Шалгалт" : "Сургалт"}</span>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-zinc-50 px-2.5 py-2 dark:bg-white/5 min-w-0">
                      <p className="text-[13px] sm:text-sm font-semibold tabular-nums">{done}/{rec.ids.length}</p>
                      <p className="mt-0.5 text-[10px] sm:text-[11px] text-zinc-500">Хариулсан</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-2.5 py-2 dark:bg-white/5 min-w-0">
                      <p className="text-[13px] sm:text-sm font-semibold tabular-nums truncate">{timeTxt}</p>
                      <p className="mt-0.5 text-[10px] sm:text-[11px] text-zinc-500">{rec.minutes > 0 ? "Үлдсэн цаг" : "Зарцуулсан"}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-zinc-100 dark:bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
                  </div>
                  <p className="mt-1.5 text-[10px] sm:text-[11px] text-zinc-500">{pct}% гүйцэтгэл</p>
                  <button onClick={() => resume(rec)} className="mt-3 self-end inline-flex items-center justify-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-[12px] sm:text-[13px] font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[36px]">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M8 5v14l11-7L8 5z" /></svg>
                    Үргэлжлүүлэх
                  </button>
                </div>
              );
            })}
        </div>
        {savedTotalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button onClick={() => setSavedPage((p) => Math.max(1, p - 1))} disabled={savedPageClamped <= 1} className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-[11px] sm:text-xs disabled:opacity-40 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[32px]">← Өмнөх</button>
          <span className="text-[11px] sm:text-xs tabular-nums text-zinc-500">{savedPageClamped} / {savedTotalPages}</span>
          <button onClick={() => setSavedPage((p) => Math.min(savedTotalPages, p + 1))} disabled={savedPageClamped >= savedTotalPages} className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-[11px] sm:text-xs disabled:opacity-40 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[32px]">Дараах →</button>
        </div>
        )}
        </>
      ) : (
        <div className="rounded-xl sm:rounded-2xl border border-dashed border-zinc-200 bg-white p-6 sm:p-10 text-center dark:border-white/15 dark:bg-white/[0.04]">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-400/10 dark:text-amber-300">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="6" y="4" width="4" height="16" rx="1.5" /><rect x="14" y="4" width="4" height="16" rx="1.5" /></svg>
          </span>
          <h3 className="mt-3 font-semibold text-[14px] sm:text-base">Хадгалсан шалгалт байхгүй байна.</h3>
          <p className="mt-1 text-[12px] sm:text-sm text-zinc-500">Шалгалтаа эхлээд түр зогсоож хадгалахад энд гарч ирнэ.</p>
          <button onClick={() => setSetupTab("exam")} className="mt-4 rounded-full bg-indigo-600 px-5 py-2 text-[12px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[36px]">
            Шалгалт эхлэх →
          </button>
        </div>
      )}
      </>)}

      {/* paywall notice (paid category / paid save action) */}
      {paywallNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="close" onClick={() => setPaywallNote(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-[#0c0c14]/95 dark:border dark:border-white/10 dark:backdrop-blur-xl">
            <p className="text-3xl">🔒</p>
            <h3 className="mt-2 font-semibold text-[15px] sm:text-lg">Төлбөртэй эрх шаардлагатай</h3>
              <p className="mt-1 text-[12px] sm:text-sm text-zinc-500">Үндсэн шалгалт, шалгалт тохиргоо, бусад ангилал болон хадгалах нь 39,900₮-ийн бүтэн эрхэд багтдаг.</p>
              <Link href="/plan" className="mt-4 flex w-full items-center justify-center rounded-full bg-indigo-600 py-2.5 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px]">Эрх авах →</Link>
              <button onClick={() => setPaywallNote(false)} className="mt-2 w-full rounded-full border border-zinc-200 py-2.5 text-[13px] sm:text-sm dark:border-white/15 min-h-[40px]">Хаах</button>
            </div>
          </div>
        )}

      {/* confirm delete saved exam */}
      {pendingDeleteExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="close" onClick={() => setPendingDeleteExam(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c0c14]/95 dark:border dark:border-white/10 dark:backdrop-blur-xl">
            <h3 className="font-semibold text-[14px] sm:text-base">Хадгалсан шалгалтыг устгах уу?</h3>
            <p className="mt-2 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">«{savedExams[pendingDeleteExam]?.tag ?? pendingDeleteExam}» устаж, буцаах боломжгүй болно.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPendingDeleteExam(null)} className="rounded-full border border-zinc-200 px-5 py-2 text-[13px] sm:text-sm dark:border-white/15 min-h-[36px]">Цуцлах</button>
              <button onClick={() => { deleteSaved(pendingDeleteExam); setPendingDeleteExam(null); }} className="rounded-full bg-rose-600 px-5 py-2 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-rose-600/30 hover:bg-rose-500 dark:bg-gradient-to-r dark:from-rose-500 dark:to-rose-600 dark:text-white dark:shadow-lg dark:shadow-rose-950/40 dark:hover:from-rose-400 dark:hover:to-rose-500 min-h-[36px]">Устгах</button>
            </div>
          </div>
        </div>
      )}

      {setupTab === "exam" && (
      <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start min-w-0">
      <button ref={secARef} onClick={() => (fullAccess ? setSettingsOpen(true) : setPaywallNote(true))} className="w-full rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-3.5 sm:p-5 dark:border-white/10 dark:bg-white/[0.04] overflow-hidden text-left hover:border-indigo-400 dark:hover:border-indigo-400/50 transition-colors min-w-0 flex flex-col">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="flex items-center gap-2 sm:gap-2.5 font-semibold text-[14px] sm:text-base truncate min-w-0">
            <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              {fullAccess ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-[18px] sm:w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="3.2" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-[18px] sm:w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="4" y="10" width="16" height="10" rx="2.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              )}
            </span>
            Шалгалт тохиргоо
          </span>
          <span className="shrink-0 rounded-full border border-zinc-200 px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-zinc-500 dark:border-white/15">Өөрчлөх →</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl bg-zinc-50 px-2.5 py-2 dark:bg-white/5 min-w-0">
            <p className="truncate text-[12px] sm:text-sm font-semibold">{mainCategory === "all" ? "Бүх үндсэн" : mainCategory}</p>
            <p className="mt-0.5 truncate text-[10px] sm:text-[11px] text-zinc-500">{subCategory === "all" ? "Бүх дэд" : subCategory}</p>
            <p className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-wide text-zinc-400">Ангилал</p>
          </div>
          <div className="rounded-xl bg-zinc-50 px-2.5 py-2 dark:bg-white/5">
            <p className="text-[12px] sm:text-sm font-semibold tabular-nums">{Math.min(count, poolSize)}</p>
            <p className="mt-0.5 truncate text-[10px] sm:text-[11px] text-zinc-500">{qtype === "all" ? "Бүх төрөл" : qtype === "case" ? "Кейс" : "Онол"}</p>
            <p className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-wide text-zinc-400">Сорилго</p>
          </div>
          <div className="rounded-xl bg-zinc-50 px-2.5 py-2 dark:bg-white/5">
            <p className="text-[12px] sm:text-sm font-semibold">{mode === "exam" ? "Шалгалт" : "Сургалт"}</p>
            <p className="mt-0.5 truncate text-[10px] sm:text-[11px] text-zinc-500">{mode === "exam" ? `${Math.min(count, poolSize)} мин` : "Хязгааргүй"}</p>
            <p className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-wide text-zinc-400">Горим</p>
          </div>
        </div>
        <div className="min-h-2 flex-1" aria-hidden />
        <div className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 text-[11px] sm:text-xs dark:border-white/10">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">Сорилгын сан</span>
            <span className="font-medium tabular-nums">{poolSize} сорилго</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">Сонгосон</span>
            <span className="font-medium tabular-nums">{Math.min(count, poolSize)} сорилго</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">Хугацаа</span>
            <span className="font-medium tabular-nums">{mode === "exam" ? `${Math.min(count, poolSize)} мин · 1 мин/сорилго` : "Хязгааргүй"}</span>
          </div>
        </div>
        {!fullAccess && <p className="mt-2.5 text-[11px] sm:text-xs leading-snug text-zinc-400">🔒 Тохиргоо өөрчлөх нь Эрх авах төлөвлөгөөнд багтдаг — үнэгүй эрхээр дэд ангиллаар шалгалт өгнө.</p>}
      </button>
      {settingsOpen && fullAccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <button aria-label="close" onClick={() => setSettingsOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl bg-white p-4 sm:p-8 shadow-xl dark:bg-[#0c0c14]/95 dark:border dark:border-white/10 dark:backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-[16px] sm:text-2xl font-semibold break-words">Шалгалт тохиргоо</h1>
              <button onClick={() => setSettingsOpen(false)} aria-label="Хаах" className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-[13px] dark:border-white/15 hover:bg-zinc-50 dark:hover:bg-white/5">✕</button>
            </div>
        

        <div className="mt-4 sm:mt-8 grid gap-4 sm:gap-6 min-w-0">
          <div className="grid gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[12px] sm:text-sm font-medium">Үндсэн ангилал</span>
            <DropSelect
              value={mainCategory}
              onChange={(v) => { setMainCategory(v); setSubCategory("all"); }}
              ariaLabel="Үндсэн ангилал"
              buttonClassName="rounded-lg sm:rounded-xl border border-zinc-200 px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[36px] sm:min-h-[48px]"
              options={[
                { value: "all", label: `Бүх үндсэн (${examCountRows(baseRows)})` },
                ...mainCategories
                  .map((c, i) => ({ value: c, label: `${!fullAccess && c !== FREE_CATEGORY ? "🔒 " : ""}${c} (${examCountRows(rowsByMain[i])})`, n: examCountRows(rowsByMain[i]) }))
                  .filter((o) => o.n > 0)
                  .map(({ value, label }) => ({ value, label })),
              ]}
            />
          </div>
          {!fullAccess && mainCategory !== "all" && mainCategory !== FREE_CATEGORY && (
            <div className="rounded-lg sm:rounded-xl border border-dashed border-zinc-200 p-3 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400 dark:border-white/15">
              🔒 «{mainCategory}» нь төлбөртэй ангилал — <Link href="/plan" className="font-medium text-indigo-600 underline dark:text-indigo-300">Эрх авах</Link> үед нээгдэнэ. Үнэгүй: {FREE_CATEGORY}.
            </div>
          )}
          <div className="grid gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[12px] sm:text-sm font-medium">Дэд ангилал</span>
            <DropSelect
              value={subCategory}
              onChange={(v) => setSubCategory(v)}
              ariaLabel="Дэд ангилал"
              buttonClassName="rounded-lg sm:rounded-xl border border-zinc-200 px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[36px] sm:min-h-[48px]"
              options={[
                { value: "all", label: `Бүх дэд (${examCountRows(labelMainRows)})` },
                ...subCategories
                  .map((c) => { const n = examCountRows(labelMainRows.filter((r) => indexSubName(index, r) === c)); return { value: c, label: `${c} (${n})`, n }; })
                  .filter((o) => o.n > 0)
                  .map(({ value, label }) => ({ value, label })),
              ]}
            />
          </div>

          <div className="grid gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[12px] sm:text-sm font-medium">Төрөл</span>
            <div className="flex gap-1.5 sm:gap-2 min-w-0">
              {([{ v: "all", label: "Бүгд" }, { v: "case", label: "Кейс" }, { v: "knowledge", label: "Онол" }] as { v: "all" | "case" | "knowledge"; label: string }[]).map((o) => (
                <button key={o.v} onClick={() => setQtype(o.v)} className={`flex-1 min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm min-h-[36px] sm:min-h-[48px] ${qtype === o.v ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5"}`}>{o.label}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[12px] sm:text-sm font-medium">Сорилгын тоо · {poolSize}</span>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 min-w-0">
              {[10, 20, 30, 50, poolSize].filter((v, i, a) => a.indexOf(v) === i).map((n) => (
                <button key={n} onClick={() => { setCount(n); setCustomCount(""); }} className={`rounded-full px-3 py-1.5 sm:px-5 sm:py-2 text-[12px] sm:text-sm border min-h-[32px] sm:min-h-[44px] shrink-0 ${customCount === "" && count === n ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5"}`}>{n === poolSize ? `Бүгд (${n})` : n}</button>
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
                className="w-28 min-w-0 rounded-lg sm:rounded-xl border border-zinc-200 px-3 py-1.5 sm:py-2 text-[13px] sm:text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[32px] sm:min-h-[44px]"
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
                <button onClick={() => setMode("exam")} className={`flex-1 min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm min-h-[36px] sm:min-h-[48px] ${mode === "exam" ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5"}`}>Шалгалт</button>
                <button onClick={() => { setMode("study"); setMinutes(0); }} className={`flex-1 min-w-0 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm min-h-[36px] sm:min-h-[48px] ${mode === "study" ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5"}`}>Сургалт</button>
              </div>
              {mode === "study" && (
                <p className="text-[11px] sm:text-xs text-zinc-500">Сорилго бүрдээ хариултаа шалгах боломжтой</p>
              )}
            </label>
            <div className={`grid gap-1.5 sm:gap-2 min-w-0 ${mode === "study" ? "opacity-50" : ""}`}>
              <span className="text-[12px] sm:text-sm font-medium">Хугацаа</span>
              <div className="w-full min-w-0 rounded-lg sm:rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:border-white/10 dark:bg-white/[0.04] min-h-[36px] sm:min-h-[48px] flex items-center text-zinc-500">
                {mode === "exam" ? `${Math.min(count, poolSize)} мин · 1 мин/сорилго` : "Хязгааргүй"}
              </div>
            </div>
          </div>

          <button onClick={() => start()} disabled={poolSize === 0} className="w-full rounded-full bg-indigo-600 py-2.5 sm:py-3 font-medium text-[13px] sm:text-base text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-40 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px] sm:min-h-[48px]">
            Эхлэх — {Math.min(count, poolSize)} сорилго
          </button>
        </div>
          </div>
        </div>
      )}

      <div ref={secBRef} className="w-full min-w-0 rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-4 sm:p-8 dark:border-white/10 dark:bg-white/[0.04] flex flex-col">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m12 2 9 4.9-9 4.9-9-4.9 9-4.9Z" /><path d="m3 12 9 4.9 9-4.9" /><path d="m3 17 9 4.9 9-4.9" /></svg>
          </span>
          <div className="min-w-0">
            <h2 className="text-[14px] sm:text-xl font-semibold break-words">Дэд ангиллаар шалгалт</h2>
            <p className="mt-0.5 text-[11px] sm:text-xs text-zinc-500">Нэг дэд ангиллын бүх сорилгоор бэлдэнэ</p>
          </div>
        </div>

        <div className="mt-3 sm:mt-4 grid gap-1.5 sm:gap-2 min-w-0">
          <span className="text-[12px] sm:text-sm font-medium">Дэд ангилал</span>
          <div className="relative min-w-0">
            <button type="button" onClick={() => setSubDropOpen((v) => !v)} className="flex w-full max-w-full min-w-0 items-center justify-between gap-2 rounded-lg sm:rounded-xl border border-zinc-200 bg-white px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:border-white/10 dark:bg-white/[0.04] min-h-[36px] sm:min-h-[48px]">
              <span className="truncate text-left">{subPair ? `${subPair.main} / ${subPair.sub} (${subPair.count})` : "Дэд ангилал сонгох…"}</span>
              <span className="shrink-0 text-xs text-zinc-400">{subDropOpen ? "▴" : "▾"}</span>
            </button>
            {subDropOpen && (
              <>
                <button aria-label="close" onClick={() => setSubDropOpen(false)} className="fixed inset-0 z-10 cursor-default bg-transparent" />
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg sm:rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:bg-[#0c0c14]/95 dark:border-white/10 dark:backdrop-blur-xl">
                  {mainCategories.filter((m) => subPairs.some((p) => p.main === m)).map((m) => (
                    <div key={m}>
                      <p className="truncate px-3 pt-2 pb-0.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{m}</p>
                      {subPairs.map((p, i) => p.main === m ? (
                        <button key={i} type="button" title={`${p.sub} (${p.count})`} onClick={() => { setSubPick(String(i)); setSubDropOpen(false); }} className={`block w-full truncate px-3 py-2 text-left text-[12px] sm:text-[13px] hover:bg-zinc-100 dark:hover:bg-white/10 ${subPick === String(i) ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200 font-medium" : ""}`}>
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
          <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl border border-dashed border-zinc-200 p-4 text-center dark:border-white/15">
            <p className="text-2xl">🔒</p>
            <p className="mt-1 font-medium text-[13px] sm:text-sm">Төлбөртэй дэд ангилал</p>
            <p className="mt-1 text-[11px] sm:text-xs text-zinc-500">«{subPair.sub}»-аар шалгалт өгөх нь Эрх авах төлөвлөгөөнд багтдаг.</p>
            <Link href="/plan" className="mt-3 inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-2.5 text-[12px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px]">
              Эрх авах — 39,900₮ →
            </Link>
          </div>
        ) : (
          <div className="mt-3 sm:mt-4 min-w-0">
            {subStats && subStats.n > 0 && subStats.best && subStats.last ? (
              <div className="rounded-lg sm:rounded-xl bg-zinc-50 p-3 sm:p-4 dark:bg-white/5">
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
              <p className="rounded-lg sm:rounded-xl bg-zinc-50 p-3 sm:p-4 text-[12px] sm:text-sm text-zinc-500 dark:bg-white/5">Энэ дэд ангиллаар оролдлого байхгүй байна — эхлээд шалгалт өгнө үү.</p>
            )}
            <button
              onClick={() => { setMainCategory(subPair.main); setSubCategory(subPair.sub); setCount(subPair.count); setCustomCount(""); start({ main: subPair.main, sub: subPair.sub, n: subPair.count, m: "exam" }); }}
              disabled={subPair.count === 0}
              className="mt-3 sm:mt-4 w-full rounded-full bg-indigo-600 py-2.5 sm:py-3 font-medium text-[13px] sm:text-base text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-40 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px] sm:min-h-[48px]"
            >
              Эхлэх — бүх {subPair.count} сорилго
            </button>
          </div>
        ))}
        <div className="min-h-2 flex-1" aria-hidden />
        <p className="mt-3 border-t border-zinc-100 pt-3 text-[11px] sm:text-xs leading-snug text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          Нийт {subPairs.length} дэд ангилал · <span className="whitespace-nowrap">⏸ — хадгалсан шалгалттай</span>
        </p>
      </div>



      <div ref={secCRef} className="w-full min-w-0 rounded-xl sm:rounded-2xl bg-zinc-950 border border-zinc-800 p-4 sm:p-8 text-white dark:bg-gradient-to-br dark:from-indigo-600/25 dark:to-violet-600/20 dark:border-indigo-400/25 overflow-hidden">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-indigo-200 ring-1 ring-inset ring-white/15">
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
          </span>
          <div className="min-w-0">
            <h2 className="text-[14px] sm:text-xl font-semibold break-words">Үндсэн шалгалт</h2>
            <p className="mt-0.5 text-[11px] sm:text-xs text-zinc-400">Бодит шалгалтын загвараар · бүх ангилал</p>
          </div>
        </div>
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
        <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] sm:text-[11px] text-zinc-200">200 сорилго</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] sm:text-[11px] text-zinc-200">200 минут</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] sm:text-[11px] text-zinc-200">1 мин/сорилго</span>
        </div>
        {mainExamStats.n > 0 && mainExamStats.best && mainExamStats.last && (
          <p className="mt-2 text-center text-[11px] sm:text-xs text-zinc-300">Оролдлого: {mainExamStats.n} · Шилдэг: {mainExamStats.best.score}/{mainExamStats.best.total} · Сүүлд: {mainExamStats.last.score}/{mainExamStats.last.total}</p>
        )}
        {!fullAccess ? (
          <button
            onClick={() => setPaywallNote(true)}
            className="mt-3 sm:mt-4 w-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 sm:py-3 font-semibold text-[13px] sm:text-base text-white shadow-lg shadow-indigo-950/40 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 min-h-[40px] sm:min-h-[48px]"
          >
            🔒 Үндсэн шалгалт эхлэх
          </button>
        ) : (
          <button
            onClick={() => { setMainCategory("all"); setSubCategory("all"); setCount(200); setCustomCount(""); setMinutes(200); start({ main: "all", sub: "all", n: 200, mins: 200, m: "exam", tag: "Үндсэн шалгалт" }); }}
            disabled={index.total === 0 || preparing}
            className="mt-3 sm:mt-4 w-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 sm:py-3 font-semibold text-[13px] sm:text-base text-white shadow-lg shadow-indigo-950/40 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 min-h-[40px] sm:min-h-[48px]"
          >
            {preparing ? "Бэлдэж байна…" : "Үндсэн шалгалт эхлэх"}
          </button>
        )}
      </div>
      </div>
      </>)}

      {setupTab === "mistakes" && (
      <>
      {/* Их алддаг сорилгууд — collapsed, questions hidden until tapped */}
      {mistakeList.length > 0 ? (
        <>
        <div className="w-full min-w-0 rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-3.5 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
                <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
              </span>
              <span className="font-semibold text-[14px] sm:text-base truncate">Их алддаг сорилгууд · {mistakeList.length}</span>
            </span>
            <button onClick={startMistakeExam} className="shrink-0 rounded-full bg-indigo-600 px-4 py-2 text-[12px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[36px]">
              Эдгээрээр шалгалт өгөх →
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 items-stretch min-w-0">
          {mistakeSlice.map(({ id, wrongCount, manual }) => (
            <div key={id} className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04] min-w-0">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <p className="min-w-0 text-[13px] sm:text-[14px] leading-snug break-words line-clamp-3">{items[id]?.question ?? "…"}</p>
                <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-rose-700 dark:bg-rose-400/15 dark:text-rose-300">
                  {wrongCount > 0 ? `✗ ${wrongCount}` : "гараар"}
                </span>
              </div>
              <button onClick={() => deleteMistake(id)} aria-label="Устгах" className="mt-3 self-start inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] sm:text-xs text-zinc-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:border-white/15 dark:hover:bg-rose-400/10 dark:hover:text-rose-400 min-h-[32px]">✕ Устгах</button>
            </div>
          ))}
        </div>
        {mistakeTotalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button onClick={() => setMistakePage((p) => Math.max(1, p - 1))} disabled={mistakePageClamped <= 1} className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-[11px] sm:text-xs disabled:opacity-40 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[32px]">← Өмнөх</button>
          <span className="text-[11px] sm:text-xs tabular-nums text-zinc-500">{mistakePageClamped} / {mistakeTotalPages}</span>
          <button onClick={() => setMistakePage((p) => Math.min(mistakeTotalPages, p + 1))} disabled={mistakePageClamped >= mistakeTotalPages} className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-[11px] sm:text-xs disabled:opacity-40 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[32px]">Дараах →</button>
        </div>
        )}
        </>
      ) : (
        <div className="w-full min-w-0 rounded-xl sm:rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.04] p-3.5 sm:p-5">
          <p className="flex items-center gap-2.5 font-semibold text-[14px] sm:text-base">
            <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
              <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            </span>
            Их алддаг сорилгууд
          </p>
          <p className="mt-1 text-[12px] sm:text-sm text-zinc-500">
            {isAuthed
              ? "Хоёр ба түүнээс дээш удаа алдсан сорилго энд гарна."
              : "Нэвтэрч орвол алдсан сорилгууд чинь энд цугларна."}
          </p>
        </div>
      )}
      </>)}
      </div>
    );
  }

  if (state === "running" && current) {
    const ans = answers[current.id];
    const correct = correctOf(current);
    const answered = ans !== undefined;
    const answeredCount = quizQs.filter((q) => answers[q.id] !== undefined).length;
    return (
      <div className="mx-auto max-w-3xl w-full space-y-3 sm:space-y-4 min-w-0 px-3 sm:px-0 max-sm:min-h-[calc(100dvh-12rem)] max-sm:flex max-sm:flex-col max-sm:justify-center">
        <div className="rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-2.5 sm:p-4 flex items-center justify-between dark:border-white/10 dark:bg-white/[0.04] gap-2 min-w-0 overflow-hidden">
          <span className="shrink-0 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] sm:text-xs font-bold tabular-nums text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">{idx + 1}<span className="mx-0.5 opacity-40">/</span>{total}</span>
          <div className="h-1.5 sm:h-2 flex-1 mx-2 sm:mx-4 rounded-full bg-zinc-100 dark:bg-white/10 overflow-hidden">
            <div className="h-full bg-indigo-600 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 transition-all duration-300" style={{ width: `${((idx + 1) / total) * 100}%` }} />
          </div>
          {minutes > 0 ? <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] sm:text-xs font-mono font-semibold tabular-nums ${timeLeft < 60 ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300" : "border-zinc-200 text-zinc-600 dark:border-white/15 dark:text-zinc-300"}`}>{fmt(timeLeft)}</span> : <span title="Зарцуулсан хугацаа" className="shrink-0 inline-flex items-center rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] sm:text-xs font-mono font-semibold tabular-nums text-zinc-600 dark:border-white/15 dark:text-zinc-300">⏱ {fmt(elapsed)}</span>}
          <button onClick={() => setNavOpen(true)} aria-label="Сорилгуудын жагсаалт" title="Сорилгуудын жагсаалт" className="shrink-0 inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-indigo-500/15 dark:hover:border-indigo-400/40 dark:hover:text-indigo-200">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="4" y="4" width="7" height="7" rx="1.5" />
              <rect x="13" y="4" width="7" height="7" rx="1.5" />
              <rect x="4" y="13" width="7" height="7" rx="1.5" />
              <rect x="13" y="13" width="7" height="7" rx="1.5" />
            </svg>
          </button>
          <button onClick={() => setPaused(true)} aria-label="Түр зогсоох" title="Түр зогсоох" className="shrink-0 inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5">⏸</button>
          <button onClick={() => setConfirmExit(true)} aria-label="Шалгалт цуцлах" title="Шалгалт цуцлах" className="shrink-0 inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-rose-400/10 dark:hover:text-rose-300">✕</button>
        </div>

        {/* pause overlay: hides the question while timer is stopped */}
        {paused && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm dark:bg-[#0c0c14]/95" />
            <div className="relative w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-xl dark:bg-[#0c0c14]/95 dark:border-white/10 dark:backdrop-blur-xl">
              <p className="text-3xl">⏸</p>
              <h3 className="mt-2 font-semibold text-[15px] sm:text-lg">Түр зогссон</h3>
              <p className="mt-1 text-[12px] sm:text-sm text-zinc-500">Хугацаа зогссон · {minutes > 0 ? fmt(timeLeft) : fmt(elapsed)}</p>
              <button onClick={() => setPaused(false)} className="mt-4 w-full rounded-full bg-indigo-600 py-2.5 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px]">Үргэлжлүүлэх ▶</button>
            </div>
          </div>
        )}

        {/* question-nav modal: grid of question numbers */}
        {navOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setNavOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60" />
            <div className="relative w-full max-w-md sm:max-w-lg rounded-2xl bg-white p-4 sm:p-6 shadow-xl dark:border dark:border-white/10 dark:bg-[#0c0c14]/95 dark:backdrop-blur-xl motion-safe:animate-[bellIn_160ms_ease-out]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-semibold text-[14px] sm:text-base">Сорилгууд</h3>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300 tabular-nums">✓ {answeredCount} / {total} хариулсан</span>
                </div>
                <button onClick={() => setNavOpen(false)} aria-label="Хаах" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-[13px] text-zinc-500 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5">✕</button>
              </div>
              <div className="mt-3 sm:mt-4 max-h-[58vh] overflow-y-auto overscroll-contain pr-0.5">
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 sm:gap-2">
                  {quizQs.map((q, i) => {
                    const isAnswered = answers[q.id] !== undefined;
                    const isCurrent = i === idx;
                    return (
                      <button
                        key={q.id}
                        onClick={() => { setIdx(i); setShowStudyFeedback(false); setNavOpen(false); window.scrollTo({ top: 0 }); }}
                        aria-label={`Сорилго ${i + 1}`}
                        className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-[12px] sm:text-[13px] font-semibold tabular-nums border transition-colors min-w-0 ${
                          isAnswered
                            ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-400 dark:bg-emerald-500/90 dark:border-emerald-400/50 dark:hover:bg-emerald-400"
                            : "bg-transparent border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/10"
                        } ${isCurrent ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-indigo-400 dark:ring-offset-transparent" : ""}`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-zinc-100 pt-3 text-[10px] sm:text-[11px] text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Хариулсан</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-indigo-500 ring-1 ring-indigo-300 dark:ring-indigo-400/40" /> Одоогийн</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-zinc-300 dark:border-white/25" /> Үлдсэн · {total - answeredCount}</span>
              </div>
            </div>
          </div>
        )}

          <div key={current.id} className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-6 dark:border-white/10 dark:bg-white/[0.04] min-w-0 select-none motion-safe:animate-[fadeUp_220ms_ease-out]">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[12px] sm:text-sm font-extrabold tabular-nums text-white shadow-sm shadow-indigo-600/30 dark:bg-gradient-to-br dark:from-indigo-500 dark:to-violet-500">{idx + 1}</span>
            <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-violet-700 dark:bg-violet-400/10 dark:text-violet-300 max-w-[46%] truncate">{current.category}</span>
            {current.subCategory && <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-zinc-600 dark:bg-white/5 dark:text-zinc-400 max-w-[34%] truncate">{current.subCategory}</span>}
            <span className="ml-auto shrink-0 rounded-full border border-zinc-200 px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-zinc-500 dark:border-white/15 dark:text-zinc-400">{runMode === "study" ? "Сургалт" : "Шалгалт"}</span>
          </div>
          <div className="mt-2.5 sm:mt-3 rounded-xl border border-violet-200 bg-violet-50/80 border-l-4 border-l-violet-500 px-3 py-3 sm:px-5 sm:py-4 dark:border-violet-400/20 dark:border-l-violet-400/70 dark:bg-violet-500/[0.12]">
            <h2 className="text-[15px] sm:text-xl font-semibold leading-snug sm:leading-relaxed break-words [overflow-wrap:anywhere] min-w-0">{current.question}</h2>
          </div>

          <div className="mt-3 sm:mt-6 grid gap-1.5 sm:gap-3 min-w-0">
            {(optionOrder[current.id] ?? current.options.map((_, oi) => oi)).map((oi, di) => {
              const opt = current.options[oi];
              const selected = ans === oi;
              const showCorrect = runMode === "study" && showStudyFeedback;
              const isCorrect = oi === correct;
              return (
                <button
                  key={oi}
                  onClick={() => { setAnswers((a) => ({ ...a, [current.id]: oi })); if (runMode === "study") setShowStudyFeedback(false); }}
                  className={`text-left rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 flex gap-2 sm:gap-3 text-[13px] sm:text-sm transition-colors min-w-0 overflow-hidden ${selected ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-100" : "border-zinc-200 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/5"} ${showCorrect && isCorrect ? "!border-emerald-500 !bg-emerald-50 !text-emerald-900 dark:!bg-emerald-400/10 dark:!text-emerald-200" : ""} ${showCorrect && selected && !isCorrect ? "!border-rose-500 !bg-rose-50 !text-rose-900 dark:!bg-rose-400/10 dark:!text-rose-200" : ""}`}
                >
                  <span className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold ${selected ? "bg-white text-indigo-700 dark:bg-white/15 dark:text-indigo-100" : "bg-indigo-50 text-indigo-600 dark:bg-white/5 dark:text-indigo-200"} ${showCorrect && isCorrect ? "!bg-emerald-500 !text-white" : ""} ${showCorrect && selected && !isCorrect ? "!bg-rose-500 !text-white" : ""}`}>{letters[di]}</span>
                  <span className="flex-1 min-w-0 break-words [overflow-wrap:anywhere] leading-snug">{opt}</span>
                </button>
              );
            })}
          </div>

          {runMode === "study" && answered && (
            <div className="mt-3 sm:mt-4 flex gap-2 min-w-0">
              {correct === null ? (
                <p className="text-[12px] sm:text-sm text-amber-600 dark:text-amber-400 break-words">Зөв хариулт тодорхойгүй тул дүгнээгүй.</p>
              ) : !showStudyFeedback ? (
                <button onClick={() => setShowStudyFeedback(true)} className="rounded-full border border-zinc-200 px-4 py-1.5 sm:px-5 sm:py-2 text-[12px] sm:text-sm dark:border-white/15 shrink-0">Хариу шалгах</button>
              ) : (
                <p className={`text-[12px] sm:text-sm font-medium break-words min-w-0 ${ans === correct ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{ans === correct ? "✓ Зөв!" : "✗ Буруу"}</p>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            <QuestionReport questionId={current.id} />
          </div>

          <div className="mt-4 sm:mt-6 min-w-0">
            <div className="sticky bottom-2 sm:bottom-3 z-10 mx-auto flex w-full max-w-md items-center gap-2 rounded-full border border-zinc-200 bg-white/95 p-1.5 shadow-lg shadow-zinc-900/5 backdrop-blur dark:border-white/10 dark:bg-[#0c0c14]/90 dark:shadow-black/40">
            <button onClick={() => { setIdx((v) => Math.max(0, v - 1)); setShowStudyFeedback(false); }} disabled={idx === 0} className="rounded-full border border-zinc-200 px-4 py-2 sm:px-5 text-[13px] sm:text-sm disabled:opacity-40 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[40px] flex-1 sm:flex-none shrink-0">Өмнөх</button>
            {idx === total - 1 ? (
              <button onClick={submit} className="flex-1 rounded-full bg-indigo-600 px-5 py-2 sm:px-7 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px] shrink-0">Дуусгах</button>
            ) : (
              <button onClick={() => { setIdx((v) => v + 1); setShowStudyFeedback(false); }} className="flex-1 rounded-full bg-indigo-600 px-5 py-2 sm:px-7 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px] shrink-0">Дараах</button>
            )}
            </div>
          </div>
        </div>

      {/* paywall notice (paid category / paid save action) */}
        {paywallNote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setPaywallNote(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-[#0c0c14]/95 dark:border dark:border-white/10 dark:backdrop-blur-xl">
              <p className="text-3xl">🔒</p>
              <h3 className="mt-2 font-semibold text-[15px] sm:text-lg">Төлбөртэй эрх шаардлагатай</h3>
              <p className="mt-1 text-[12px] sm:text-sm text-zinc-500">Бусад ангиллаар шалгалт өгөх, хадгалах нь 39,900₮-ийн бүтэн эрхэд багтдаг.</p>
              <Link href="/plan" className="mt-4 flex w-full items-center justify-center rounded-full bg-indigo-600 py-2.5 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px]">Эрх авах →</Link>
              <button onClick={() => setPaywallNote(false)} className="mt-2 w-full rounded-full border border-zinc-200 py-2.5 text-[13px] sm:text-sm dark:border-white/15 min-h-[40px]">Хаах</button>
            </div>
          </div>
        )}

        {/* confirm exit exam (save & continue later) */}
        {confirmExit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setConfirmExit(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c0c14]/95 dark:border dark:border-white/10 dark:backdrop-blur-xl">
              {!fullAccess ? (
                <>
                  <h3 className="font-semibold text-[14px] sm:text-base">🔒 Хадгалах нь төлбөртэй</h3>
                  <p className="mt-2 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">Шалгалт түр зогсоож, үргэлжлүүлэх нь Эрх авах төлөвлөгөөнд багтдаг.</p>
                  <div className="mt-4 grid gap-2">
                    <Link href="/plan" className="flex w-full items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px]">Эрх авах — 39,900₮ →</Link>
                    <button onClick={() => { setConfirmExit(false); setShowStudyFeedback(false); setState("setup"); }} className="rounded-full border border-zinc-200 px-5 py-2 text-[13px] sm:text-sm dark:border-white/15 min-h-[36px]">Хадгалахгүй гарах</button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-[14px] sm:text-base">Шалгалтыг түр зогсоох уу?</h3>
                  <p className="mt-2 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">Хариултууд хадгалагдаж, явсан газраасаа үргэлжлүүлнэ.</p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => setConfirmExit(false)} className="rounded-full border border-zinc-200 px-5 py-2 text-[13px] sm:text-sm dark:border-white/15 min-h-[36px]">Үргэлжлүүлэх</button>
                    <button onClick={() => { saveExamNow(); setConfirmExit(false); setShowStudyFeedback(false); setState("setup"); }} className="rounded-full bg-indigo-600 px-5 py-2 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[36px]">Хадгалах</button>
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
  const ring = 2 * Math.PI * 54;
  const statusOf = (q: Question) => {
    const a = answers[q.id];
    const c = correctOf(q);
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
    st === "correct" ? "bg-emerald-600 text-white dark:bg-emerald-500" :
    st === "wrong" ? "bg-rose-600 text-white dark:bg-rose-500" :
    st === "unanswered" ? "bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300" :
    "bg-amber-400 text-white";
  const dotSym = (st: string) => (st === "correct" ? "✓" : st === "wrong" ? "✗" : st === "unanswered" ? "○" : "?");
  return (
    <div className="mx-auto max-w-3xl w-full space-y-3 sm:space-y-6 min-w-0 overflow-hidden px-3 sm:px-0">
      {/* summary dashboard */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 sm:p-8 dark:border-white/10 dark:bg-white/[0.04] min-w-0">
        <div aria-hidden className={`pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl ${pct >= 60 ? "bg-emerald-500/10" : "bg-rose-500/10"}`} />
        <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-8 motion-safe:animate-[popIn_260ms_ease-out]">
          <div className="relative shrink-0">
            <svg viewBox="0 0 120 120" className="h-28 w-28 sm:h-36 sm:w-36 -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r="54" fill="none" strokeWidth="10" className="stroke-zinc-100 dark:stroke-white/10" />
              <circle cx="60" cy="60" r="54" fill="none" strokeWidth="10" strokeLinecap="round" className={pct >= 60 ? "stroke-emerald-500" : "stroke-rose-500"} strokeDasharray={ring} strokeDashoffset={ring * (1 - Math.max(Math.min(pct, 100), 0) / 100)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl sm:text-4xl font-extrabold tabular-nums leading-none">{pct}%</p>
              <p className="mt-0.5 text-[10px] sm:text-xs text-zinc-500">{score} / {total}</p>
            </div>
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Дүн</h1>
            <div className="mt-1.5 sm:mt-2 flex flex-wrap justify-center sm:justify-start gap-1.5">
              {runMode === "exam" && <span className={`rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-bold ${pct >= 60 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"}`}>{pct >= 60 ? "Тэнцсэн" : "Унасан"}</span>}
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">✓ Зөв · {resultStats.ok}</span>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-rose-600 dark:bg-rose-400/10 dark:text-rose-400">✗ Буруу · {resultStats.wrong}</span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">○ Хариулаагүй · {resultStats.un}</span>
              {resultStats.unk > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">? Тодорхойгүй · {resultStats.unk}</span>}
            </div>
            <p className="mt-2 text-[12px] sm:text-sm text-zinc-500">⏱ {fmt(elapsed)} зарцуулсан{runMode === "study" ? " · дүн түүхэнд хадгалагдаагүй" : ""}</p>
          </div>
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
                  <div className="mt-0.5 h-1.5 rounded-full bg-zinc-100 dark:bg-white/10 overflow-hidden">
                    <div className={`h-full rounded-full ${p >= 70 ? "bg-emerald-500" : p >= 40 ? "bg-amber-400" : "bg-rose-500"}`} style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 sm:mt-6 flex justify-center gap-2">
          <button onClick={backToSetup} className="rounded-full border border-zinc-200 px-5 py-2 sm:px-6 sm:py-3 text-[13px] sm:text-sm font-medium hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[36px] sm:min-h-0">← Шалгалт</button>
          <button onClick={restart} className="rounded-full bg-indigo-600 px-6 py-2 sm:px-8 sm:py-3 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[36px] sm:min-h-0">Дахин эхлэх</button>
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
            className={`shrink-0 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-[12px] sm:text-sm border min-h-[32px] sm:min-h-[36px] ${(resultStats.wrong + resultStats.un > 0 ? reviewFilter : "all") === t.k ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/5"}`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => {
            if (allOpen) setExpanded({});
            else { const o: Record<string, boolean> = {}; reviewItems.forEach(({ q }) => { o[q.id] = true; }); setExpanded((p) => ({ ...p, ...o })); }
          }}
          className="shrink-0 ml-auto text-[11px] sm:text-xs underline text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300"
        >
          {allOpen ? "Бүгдийг хураах" : "Бүгдийг нээх"}
        </button>
      </div>

      {/* review: collapsed rows, tap to expand */}
      <div className="space-y-2 sm:space-y-4 min-w-0 select-none">
        {reviewItems.map(({ q, i, st }) => {
          const a = answers[q.id];
          const c = correctOf(q);
          const unknown = st === "unknown";
          const ok = st === "correct";
          const open = !!expanded[q.id];
          return (
            <div key={q.id} className={`rounded-xl sm:rounded-2xl border min-w-0 overflow-hidden ${unknown ? "bg-zinc-50 border-zinc-200 dark:bg-white/[0.04] dark:border-white/10" : ok ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-400/10 dark:border-emerald-400/30" : "bg-rose-50 border-rose-200 dark:bg-rose-400/10 dark:border-rose-400/30"}`}>
              <button onClick={() => setExpanded((p) => ({ ...p, [q.id]: !p[q.id] }))} className="w-full flex items-center gap-2 p-3 sm:p-4 text-left min-w-0">
                <span className={`flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold ${dotCls(st)}`}>{dotSym(st)}</span>
                <span className="text-zinc-400 text-[11px] sm:text-sm shrink-0">{i + 1}.</span>
                <span className={`flex-1 min-w-0 text-[13px] sm:text-sm leading-snug break-words ${open ? "" : "line-clamp-2"}`}>{q.question}</span>
                <span className="text-zinc-400 text-xs shrink-0">{open ? "▾" : "▸"}</span>
              </button>
              {open && (
                <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                  <p className="text-[10px] sm:text-xs text-zinc-500 break-words">{q.category}{q.subCategory ? ` · ${q.subCategory}` : ""} {unknown ? "· хариултгүй" : ""} {st === "unanswered" ? "· хариулаагүй" : ""}</p>
                  <div className="mt-2 grid gap-1.5 sm:gap-2 min-w-0">
                    {(optionOrder[q.id] ?? q.options.map((_, oi) => oi)).map((oi, di) => (
                      <div key={oi} className={`rounded-lg sm:rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 text-[12px] sm:text-sm flex gap-1.5 sm:gap-2 min-w-0 overflow-hidden ${!unknown && oi === c ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-400/10" : ""} ${oi === a && !ok && !unknown ? "border-rose-500 bg-rose-100 dark:bg-rose-400/10" : "bg-white dark:bg-white/5"}`}>
                        <span className="font-bold shrink-0">{letters[di]}.</span><span className="flex-1 min-w-0 break-words [overflow-wrap:anywhere] leading-snug">{q.options[oi]} {!unknown && oi === c && "✓"} {oi === a && oi !== c && !unknown && "← таны сонголт"}</span>
                      </div>
                    ))}
                  </div>
                  {isAuthed && (st === "wrong" || st === "unanswered") && (
                    mistakes[q.id] && (mistakes[q.id].wrongCount >= 2 || mistakes[q.id].manual)
                      ? <p className="mt-2 text-[11px] sm:text-xs text-zinc-500">✓ Их алддагт нэмэгдсэн{mistakes[q.id].wrongCount > 0 ? ` · ✗ ${mistakes[q.id].wrongCount}` : ""}</p>
                      : <button onClick={() => addManualMistake(q.id)} className="mt-2 rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] sm:text-xs font-medium hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[36px]">+ Их алддагт нэмэх</button>
                  )}
                  {unknown && <p className="mt-1.5 text-[11px] sm:text-xs text-zinc-500 break-words">Зөв хариулт тодорхойгүй тул дүгнээгүй.</p>}
                </div>
              )}
            </div>
          );
        })}
        {reviewItems.length === 0 && <p className="text-center py-8 text-[13px] sm:text-sm text-zinc-500">Бүгд зөв — мундаг! 🎉</p>}
      </div>

      {/* bottom nav back to quiz */}
      <div className="flex justify-center gap-2 pb-2">
        <button onClick={backToSetup} className="rounded-full border border-zinc-200 px-5 py-2 text-[13px] sm:text-sm font-medium hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[36px]">← Шалгалт</button>
        <button onClick={restart} className="rounded-full bg-indigo-600 px-6 py-2 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[36px]">Дахин эхлэх</button>
      </div>
    </div>
  );
}
