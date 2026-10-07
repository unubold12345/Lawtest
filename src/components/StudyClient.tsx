"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Question } from "@/types/question";
import { fileAnswer } from "@/lib/voteJudge";
import { FREE_CATEGORY } from "@/lib/access";
import DropSelect from "@/components/DropSelect";
import { indexSubName, type IndexData, type IndexRow } from "@/lib/questionIndex";
import { fetchQuestionsByIds } from "@/lib/fetchQuestionsByIds";
import QuestionNote from "@/components/QuestionNote";
import QuestionReport from "@/components/QuestionReport";
import {
  readStudySession,
  writeStudySession,
  clearStudySession,
  bumpStudyDay,
  studyStreak,
  fmtClock,
  type StudyRunType,
  type StudySession,
} from "@/lib/studySession";

// ─── Сорилго v2 (/v2) ───────────────────────────────────────────────────────
// Study-first mode: pick a scope, drill questions with instant feedback,
// explanations, notes, flags — and track per-question progress (StudyCard)
// so the dashboard can show coverage, accuracy, weak spots and smart queues
// (missed → new → rest). Built for efficient repetition, not for browsing.

type StudyView = "home" | "run" | "summary";

// client mirror of a StudyCard row: a=attempts, c=correct, s=streak, ok=last, t=lastSeenAt
type CardInfo = { a: number; c: number; s: number; ok: boolean; t: number };
type CardMap = Record<string, CardInfo>;
type Agg = { total: number; covered: number; mastered: number; solved: number; correct: number; attempts: number };

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const TYPE_LABEL: Record<StudyRunType, string> = {
  smart: "Ухаалаг",
  new: "Шинэ",
  missed: "Алдсан",
  refresh: "Сэргээх",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type TodoItem = { id: string; text: string; main: string; sub: string; done: boolean; date: string };

// ── dashboard helpers ──────────────────────────────────────────────────────
function Greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Шөнийн мэнд";
  if (h < 11) return "Өглөөний мэнд";
  if (h < 17) return "Өдрийн мэнд";
  return "Оройн мэнд";
}

function ReadinessRing({ value, covered, total }: { value: number; covered: number; total: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), 150);
    return () => window.clearTimeout(t);
  }, [value]);
  const R = 44;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative h-[118px] w-[118px] shrink-0">
      <div aria-hidden className="absolute inset-3 rounded-full bg-indigo-500/15 blur-xl dark:bg-indigo-400/25" />
      <svg viewBox="0 0 118 118" className="relative h-full w-full -rotate-90">
        <circle cx="59" cy="59" r={R} fill="none" strokeWidth="10" className="stroke-zinc-200/80 dark:stroke-white/10" />
        <circle
          cx="59"
          cy="59"
          r={R}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-indigo-500 transition-[stroke-dashoffset] duration-[1200ms] ease-out dark:stroke-indigo-400"
          strokeDasharray={C}
          strokeDashoffset={C - (C * v) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[21px] font-extrabold leading-none tabular-nums">{value}%</span>
        <span className="mt-0.5 text-[10px] font-medium text-zinc-500">бэлэн байдал</span>
        <span className="text-[9px] tabular-nums text-zinc-400">
          {covered}/{total}
        </span>
      </div>
    </div>
  );
}

const DAY_SHORT = ["Дав", "Мяг", "Лха", "Пүр", "Баа", "Бям", "Ням"];

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function shiftDayKey(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

function dayTitle(key: string): string {
  const today = dayKey(new Date());
  if (key === today) return "Өнөөдөр";
  if (key === shiftDayKey(today, 1)) return "Маргааш";
  if (key === shiftDayKey(today, -1)) return "Өчигдөр";
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}-р сарын ${d} · ${DAY_SHORT[(dt.getDay() + 6) % 7]}`;
}

function ActivityBars({ days }: { days: number[] }) {
  const max = Math.max(1, ...days);
  const sum = days.reduce((a, b) => a + b, 0);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-[10px] font-medium text-zinc-400">
        <span>Сүүлийн 7 хоног</span>
        <span className="tabular-nums">{sum} сорилго</span>
      </div>
      <div className="mt-1.5 flex items-end gap-1.5">
        {days.map((n, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-9 w-full items-end justify-center">
              <div
                className={`w-full max-w-[26px] rounded-md transition-all duration-700 ${
                  i === 6
                    ? "bg-gradient-to-t from-indigo-600 to-violet-500 dark:from-indigo-500 dark:to-violet-400"
                    : "bg-indigo-300/60 dark:bg-indigo-400/35"
                }`}
                style={{ height: `${Math.max(10, Math.round((n / max) * 100))}%` }}
                title={`${DAY_SHORT[i]}: ${n}`}
              />
            </div>
            <span className="text-[9px] font-medium text-zinc-400">{DAY_SHORT[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function StudyClient({ index }: { index: IndexData }) {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthed = !!session?.user;
  const userId = (session?.user as unknown as { id?: string } | undefined)?.id ?? null;
  const fullAccess =
    (session?.user as unknown as { hasPaid?: boolean; role?: string } | undefined)?.hasPaid === true ||
    (session?.user as unknown as { role?: string } | undefined)?.role === "ADMIN";
  const collator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }), []);

  // ── question cache (ids fetched on demand, same pattern as quiz/browse) ──
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
      if (need.length > 0) mergeItems(await fetchQuestionsByIds(need));
      return uniq.map((id) => itemsRef.current[id]).filter((q): q is Question => !!q);
    },
    [mergeItems]
  );

  // ── server-side progress + personal data ──
  const [cards, setCards] = useState<CardMap>({});
  const [cardsReady, setCardsReady] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<Record<string, number>>({});
  const [mistakes, setMistakes] = useState<Record<string, { wrongCount: number; manual: boolean }>>({});
  const [notedIds, setNotedIds] = useState<Set<string>>(new Set());
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    if (!isAuthed) {
      setCards({});
      setCardsReady(false);
      return;
    }
    let cancelled = false;
    fetch("/api/study")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.cards) {
          const m: CardMap = {};
          (d.cards as Array<[string, number, number, number, number, number]>).forEach((row) => {
            m[row[0]] = { a: row[1], c: row[2], s: row[3], ok: row[4] === 1, t: row[5] };
          });
          setCards(m);
        }
        setCardsReady(true);
      })
      .catch(() => setCardsReady(true));
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) {
      setSavedAnswers({});
      setNotedIds(new Set());
      return;
    }
    let cancelled = false;
    fetch("/api/saved-answers?mine=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.my) setSavedAnswers(d.my as Record<string, number>);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) {
      setMistakes({});
      return;
    }
    let cancelled = false;
    fetch("/api/mistakes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.mistakes) return;
        const m: Record<string, { wrongCount: number; manual: boolean }> = {};
        (d.mistakes as Array<{ questionId: string; wrongCount: number; manual: boolean }>).forEach((row) => {
          m[row.questionId] = { wrongCount: row.wrongCount, manual: row.manual };
        });
        setMistakes(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    fetch("/api/notes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.ids)) setNotedIds(new Set(d.ids as string[]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    setStreakDays(studyStreak(userId));
  }, [userId, sessionStatus]);

  // ── rows / access ──
  const rowById = useMemo(() => {
    const m = new Map<string, IndexRow>();
    for (const r of index.rows) m.set(r[0], r);
    return m;
  }, [index]);
  const freeIdx = useMemo(() => index.mains.findIndex((m) => m.name === FREE_CATEGORY), [index]);
  const baseRows = useMemo(
    () => (fullAccess || freeIdx < 0 ? index.rows : index.rows.filter((r) => r[1] === freeIdx)),
    [index, fullAccess, freeIdx]
  );
  // studyable = has an official answer (file or admin-added) or the user's own saved answer
  const studyableOf = useCallback(
    (r: IndexRow) => r[3] === 1 || r[5] === 1 || savedAnswers[r[0]] !== undefined,
    [savedAnswers]
  );
  const correctOf = useCallback(
    (q: Question): number | null => {
      const mine = savedAnswers[q.id];
      if (typeof mine === "number" && Number.isInteger(mine) && mine >= 0 && mine < q.options.length) return mine;
      return fileAnswer(q);
    },
    [savedAnswers]
  );

  // ── view / run state ──
  const [view, setView] = useState<StudyView>("home");
  const [preparing, setPreparing] = useState<string | null>(null);
  const [run, setRun] = useState<StudySession | null>(null);
  const [resumeRec, setResumeRec] = useState<StudySession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const runRef = useRef<StudySession | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [paywallNote, setPaywallNote] = useState(false);

  // ── to-do list inputs ──
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [readyMains, setReadyMains] = useState<Record<string, boolean>>({});
  const [todoMain, setTodoMain] = useState("all");
  const [todoSub, setTodoSub] = useState("all");
  const [todoText, setTodoText] = useState("");
  const [todoDate, setTodoDate] = useState(() => dayKey(new Date()));
  const [immediateOn, setImmediateOn] = useState(true);

  // ── home / summary ui ──
  const [reviewFilter, setReviewFilter] = useState<"missed" | "all" | "correct">("missed");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    setResumeRec(readStudySession(userId));
  }, [userId, sessionStatus]);

  // persist the in-progress session on structural changes (answers / nav)
  useEffect(() => {
    if (view !== "run" || !run) return;
    writeStudySession({ ...run, elapsed: elapsedRef.current, updatedAt: Date.now() }, userId);
  }, [run, view, userId]);

  useEffect(() => {
    if (view !== "run") return;
    const t = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [view]);

  useEffect(() => {
    if (view !== "run") return;
    const h = () => {
      if (runRef.current) writeStudySession({ ...runRef.current, elapsed: elapsedRef.current }, userId);
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [view, userId]);

  // ── session assembly ──
  const buildRows = useCallback(
    (main: string, sub: string, type: StudyRunType): IndexRow[] => {
      let rows = baseRows.filter(studyableOf);
      if (main !== "all") {
        const mi = index.mains.findIndex((m) => m.name === main);
        rows = mi >= 0 ? rows.filter((r) => r[1] === mi) : [];
      }
      if (sub !== "all") rows = rows.filter((r) => indexSubName(index, r) === sub);
      const bySeenAsc = (a: IndexRow, b: IndexRow) => {
        const ca = cards[a[0]], cb = cards[b[0]];
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.t - cb.t;
      };
      const isMissed = (r: IndexRow) => {
        const c = cards[r[0]];
        return !!c && c.ok === false;
      };
      const isExamMissed = (r: IndexRow) => !cards[r[0]] && (mistakes[r[0]]?.wrongCount ?? 0) > 0;
      const byWrongDesc = (a: IndexRow, b: IndexRow) =>
        (mistakes[b[0]]?.wrongCount ?? 0) - (mistakes[a[0]]?.wrongCount ?? 0);
      switch (type) {
        case "new":
          return shuffle(rows.filter((r) => !cards[r[0]]));
        case "refresh":
          return rows.filter((r) => cards[r[0]]).sort(bySeenAsc);
        case "missed":
          return [
            ...rows.filter(isMissed).sort(bySeenAsc),
            ...rows.filter(isExamMissed).sort(byWrongDesc),
          ];
        default: {
          const missed = rows.filter(isMissed).sort(bySeenAsc);
          const exam = rows.filter(isExamMissed).sort(byWrongDesc);
          const unseen = shuffle(rows.filter((r) => !cards[r[0]] && !isExamMissed(r)));
          const seen = shuffle(rows.filter((r) => cards[r[0]] && cards[r[0]].ok === true));
          return [...missed, ...exam, ...unseen, ...seen];
        }
      }
    },
    [baseRows, studyableOf, index, cards, mistakes]
  );

  const preCounts = useMemo(() => {
    const rows = baseRows.filter(studyableOf);
    let noCard = 0,
      examMiss = 0,
      missedCard = 0,
      studied = 0;
    for (const r of rows) {
      const c = cards[r[0]];
      if (!c) {
        noCard++;
        if ((mistakes[r[0]]?.wrongCount ?? 0) > 0) examMiss++;
      } else {
        studied++;
        if (c.ok === false) missedCard++;
      }
    }
    return { total: rows.length, unseen: noCard, missed: missedCard + examMiss, refresh: studied };
  }, [baseRows, studyableOf, cards, mistakes]);

  // ── progress aggregates (dashboard) ──
  const progress = useMemo(() => {
    const idPair = new Map<string, [number, number]>();
    const mainAgg = new Map<number, Agg>();
    const subAgg = new Map<string, Agg & { mi: number; si: number }>();
    const seed = (): Agg => ({ total: 0, covered: 0, mastered: 0, solved: 0, correct: 0, attempts: 0 });
    for (const r of baseRows) {
      if (!studyableOf(r)) continue;
      idPair.set(r[0], [r[1], r[2]]);
      if (r[1] >= 0) {
        const ma = mainAgg.get(r[1]) ?? seed();
        ma.total++;
        mainAgg.set(r[1], ma);
        const sk = `${r[1]}\u0001${r[2]}`;
        const sa = subAgg.get(sk) ?? { mi: r[1], si: r[2], ...seed() };
        sa.total++;
        subAgg.set(sk, sa);
      }
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let covered = 0,
      mastered = 0,
      solved = 0,
      correct = 0,
      attempts = 0,
      today = 0;
    for (const [id, ci] of Object.entries(cards)) {
      const pair = idPair.get(id);
      if (!pair) continue;
      covered++;
      correct += ci.c;
      attempts += ci.a;
      if (ci.s >= 2) mastered++;
      if (ci.c > 0) solved++;
      if (ci.t >= todayStart.getTime()) today++;
      const ma = mainAgg.get(pair[0]);
      if (ma) {
        ma.covered++;
        ma.correct += ci.c;
        ma.attempts += ci.a;
        if (ci.s >= 2) ma.mastered++;
        if (ci.c > 0) ma.solved++;
      }
      const sa = subAgg.get(`${pair[0]}\u0001${pair[1]}`);
      if (sa) {
        sa.covered++;
        sa.correct += ci.c;
        sa.attempts += ci.a;
        if (ci.s >= 2) sa.mastered++;
        if (ci.c > 0) sa.solved++;
      }
    }
    return { total: idPair.size, covered, mastered, solved, correct, attempts, today, mainAgg, subAgg };
  }, [baseRows, studyableOf, cards]);

  const accOf = (a: Agg) => (a.attempts > 0 ? Math.round((a.correct / a.attempts) * 100) : 0);
  const readiness = progress.total > 0 ? Math.round((progress.covered / progress.total) * 100) : 0;
  const activity7 = useMemo(() => {
    const out = new Array(7).fill(0) as number[];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const t0 = todayStart.getTime();
    const dayMs = 86400000;
    for (const ci of Object.values(cards)) {
      if (!ci.t) continue;
      const d = Math.floor((ci.t - t0) / dayMs);
      if (d <= 0 && d > -7) out[6 + d]++;
    }
    return out;
  }, [cards]);

  // ── to-do / map option lists ──
  const mainOptions = useMemo(() => {
    const counts = new Map<number, number>();
    for (const r of index.rows) if (r[1] >= 0 && studyableOf(r)) counts.set(r[1], (counts.get(r[1]) ?? 0) + 1);
    return index.mains
      .map((m, i) => ({ mi: i, name: m.name, n: counts.get(i) ?? 0 }))
      .filter((o) => o.n > 0);
  }, [index, studyableOf]);

  const subOptions = useMemo(() => {
    const counts = new Map<string, number>();
    const mi = todoMain === "all" ? -1 : index.mains.findIndex((m) => m.name === todoMain);
    const rows = mi >= 0 ? baseRows.filter((r) => r[1] === mi) : baseRows;
    for (const r of rows) {
      if (!studyableOf(r)) continue;
      const name = indexSubName(index, r);
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => collator.compare(a[0], b[0]));
  }, [baseRows, studyableOf, todoMain, index, collator]);

  useEffect(() => {
    if (todoSub !== "all" && !subOptions.some(([n]) => n === todoSub)) setTodoSub("all");
  }, [subOptions, todoSub]);

  // ── local writers ──
  const applyLocalResult = useCallback((id: string, ok: boolean) => {
    setCards((prev) => {
      const cur = prev[id] ?? { a: 0, c: 0, s: 0, ok: false, t: 0 };
      return { ...prev, [id]: { a: cur.a + 1, c: cur.c + (ok ? 1 : 0), s: ok ? cur.s + 1 : 0, ok, t: Date.now() } };
    });
  }, []);
  const applyLocalWrong = useCallback((id: string) => {
    setMistakes((prev) => ({
      ...prev,
      [id]: { wrongCount: (prev[id]?.wrongCount ?? 0) + 1, manual: prev[id]?.manual ?? false },
    }));
  }, []);
  const postStudy = (results: Array<{ id: string; ok: boolean }>) => {
    if (!isAuthed || results.length === 0) return;
    // sessions can hold up to 400 questions — the API caps at 200 per call
    for (let i = 0; i < results.length; i += 200) {
      const chunk = results.slice(i, i + 200);
      fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: chunk }),
      }).catch(() => {});
    }
  };
  const postWrongs = (ids: string[]) => {
    if (!isAuthed || ids.length === 0) return;
    // the mistakes API caps ids at 200 per call
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      fetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: chunk }),
      }).catch(() => {});
    }
  };
  const markDay = (uid: string | null) => {
    bumpStudyDay(uid);
    setStreakDays(studyStreak(uid));
  };

  const toggleFlag = (id: string) => {
    if (!isAuthed) return;
    const flagged = !!mistakes[id]?.manual;
    setMistakes((prev) => {
      const n = { ...prev };
      if (flagged) delete n[id];
      else n[id] = { wrongCount: prev[id]?.wrongCount ?? 0, manual: true };
      return n;
    });
    if (flagged) fetch(`/api/mistakes?questionId=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    else
      fetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: id, manual: true }),
      }).catch(() => {});
  };

  // ── session lifecycle ──
  // ── warm-up (live dashboard question) ──
  const [warm, setWarm] = useState<{ ids: string[]; i: number; pick: number | null; score: number }>({
    ids: [],
    i: 0,
    pick: null,
    score: 0,
  });
  const [mapMain, setMapMain] = useState<number | null>(null);
  const [mapPicks, setMapPicks] = useState<Record<string, number>>({});
  const mapSubs =
    mapMain !== null && index.mains[mapMain]
      ? index.mains[mapMain].subs
          .map((s, si) => ({ si, name: s.name, agg: progress.subAgg.get(`${mapMain}\u0001${si}`) }))
          .filter((x): x is { si: number; name: string; agg: Agg & { mi: number; si: number } } => !!x.agg && x.agg.total > 0)
      : [];
  const mapPickedTotal =
    mapMain === null
      ? 0
      : mapSubs.reduce((a, s) => a + Math.max(0, Math.min(mapPicks[`${mapMain}\u0001${s.si}`] ?? 0, s.agg.total)), 0);
  useEffect(() => {
    if (view !== "home") return;
    const rows = baseRows.filter(studyableOf);
    if (rows.length === 0) return;
    setWarm((w) =>
      w.ids.length > 0 ? w : { ids: shuffle(rows.map((r) => r[0])).slice(0, 8), i: 0, pick: null, score: 0 }
    );
  }, [view, baseRows, studyableOf]);
  useEffect(() => {
    if (warm.ids.length === 0) return;
    void fetchItems(warm.ids.slice(warm.i, warm.i + 2));
  }, [warm.ids, warm.i, fetchItems]);
  const warmQ = warm.ids.length > 0 ? items[warm.ids[warm.i]] : undefined;
  const warmAnswer = (oi: number) => {
    if (!warmQ || warm.pick !== null) return;
    const c = correctOf(warmQ);
    const ok = c !== null && oi === c;
    setWarm((w) => ({ ...w, pick: oi, score: w.score + (ok ? 1 : 0) }));
    if (isAuthed) {
      applyLocalResult(warmQ.id, ok);
      postStudy([{ id: warmQ.id, ok }]);
    }
  };
  const warmNext = () => {
    setWarm((w) => ({ ...w, i: w.ids.length > 0 ? (w.i + 1) % w.ids.length : 0, pick: null }));
  };

  // ── to-do list (localStorage, per user) ──
  const todoKey = `lexlab-study-todos:${userId ?? "guest"}`;
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(todoKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      const today = dayKey(new Date());
      setTodos(Array.isArray(parsed) ? (parsed as TodoItem[]).map((t) => ({ ...t, date: t.date || today })) : []);
    } catch {
      setTodos([]);
    }
  }, [todoKey]);
  const persistTodos = useCallback(
    (next: TodoItem[]) => {
      setTodos(next);
      try {
        window.localStorage.setItem(todoKey, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
    },
    [todoKey]
  );
  const addTodo = () => {
    const text = todoText.trim();
    const scoped = todoMain !== "all" || todoSub !== "all";
    if (!text && !scoped) return;
    persistTodos([
      {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        text,
        main: text ? "all" : todoMain,
        sub: text ? "all" : todoSub,
        done: false,
        date: todoDate,
      },
      ...todos,
    ]);
    setTodoText("");
  };
  const toggleTodo = (id: string) => persistTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const removeTodo = (id: string) => persistTodos(todos.filter((t) => t.id !== id));
  const clearDoneTodos = () => persistTodos(todos.filter((t) => !(t.done && t.date === todoDate)));

  // ── category readiness (localStorage, per user) ──
  const readyKey = `lexlab-study-ready:${userId ?? "guest"}`;
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(readyKey);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      setReadyMains(parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {});
    } catch {
      setReadyMains({});
    }
  }, [readyKey]);
  const toggleReady = (name: string) => {
    setReadyMains((prev) => {
      const next = { ...prev };
      if (next[name]) delete next[name];
      else next[name] = true;
      try {
        window.localStorage.setItem(readyKey, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };
  const beginRun = useCallback(
    (rec: StudySession, uid: string | null) => {
      setRun(rec);
      setElapsed(rec.elapsed);
      elapsedRef.current = rec.elapsed;
      setPaletteOpen(false);
      setExitConfirm(false);
      setReviewFilter("missed");
      setExpanded({});
      setView("run");
      writeStudySession(rec, uid);
      window.scrollTo({ top: 0 });
    },
    []
  );

  const startSession = (
    o: { main?: string; sub?: string; type?: StudyRunType; n?: number; all?: boolean; picks?: Array<{ sub: string; n: number }> } = {}
  ) => {
    if (preparing) return;
    const main = o.main ?? "all";
    const sub = o.sub ?? "all";
    const type = o.type ?? "smart";
    if (!fullAccess && main !== "all" && main !== FREE_CATEGORY) {
      setPaywallNote(true);
      return;
    }
    let picked: IndexRow[];
    if (o.picks && o.picks.length > 0) {
      picked = o.picks.flatMap((p) => buildRows(main, p.sub, type).slice(0, Math.max(1, p.n)));
    } else {
      const candidates = buildRows(main, sub, type);
      if (candidates.length === 0) return;
      const n = o.all ? candidates.length : (o.n ?? 20);
      picked = candidates.slice(0, Math.max(1, Math.min(n, candidates.length)));
    }
    if (picked.length === 0) return;
    setPreparing("start");
    fetchItems(picked.map((r) => r[0]))
      .then((qs) => {
        if (qs.length === 0) return;
        const order: Record<string, number[]> = {};
        qs.forEach((q) => {
          order[q.id] = shuffle(q.options.map((_, oi) => oi));
        });
        beginRun(
          {
            v: 2,
            main,
            sub,
            type,
            immediate: immediateOn,
            ids: qs.map((q) => q.id),
            order,
            answers: {},
            idx: 0,
            elapsed: 0,
            startedAt: Date.now(),
            updatedAt: Date.now(),
          },
          userId
        );
      })
      .finally(() => setPreparing(null));
  };

  const resumeRun = () => {
    if (!resumeRec || preparing) return;
    const known = resumeRec.ids.filter((id) => rowById.has(id));
    if (known.length === 0) {
      clearStudySession(userId);
      setResumeRec(null);
      return;
    }
    setPreparing("resume");
    fetchItems(known)
      .then((qs) => {
        if (qs.length === 0) return;
        beginRun({ ...resumeRec, ids: known }, userId);
      })
      .finally(() => setPreparing(null));
  };

  const discardResume = () => {
    clearStudySession(userId);
    setResumeRec(null);
  };

  const exitRun = () => {
    if (run) {
      const rec = { ...run, elapsed: elapsedRef.current, updatedAt: Date.now() };
      writeStudySession(rec, userId);
      setResumeRec(rec);
    }
    setExitConfirm(false);
    setPaletteOpen(false);
    setRun(null);
    setView("home");
    window.scrollTo({ top: 0 });
  };

  const answerCurrent = (oi: number) => {
    if (!run) return;
    const q = items[run.ids[run.idx]];
    if (!q) return;
    if (run.immediate && run.answers[q.id] !== undefined) return; // locked after reveal
    const c = correctOf(q);
    setRun((prev) => (prev ? { ...prev, answers: { ...prev.answers, [q.id]: oi } } : prev));
    if (run.immediate && c !== null) {
      const ok = oi === c;
      applyLocalResult(q.id, ok);
      postStudy([{ id: q.id, ok }]);
      if (!ok) {
        applyLocalWrong(q.id);
        postWrongs([q.id]);
      }
    }
    markDay(userId);
  };

  const goIdx = (v: number) => {
    setRun((prev) =>
      prev ? { ...prev, idx: Math.max(0, Math.min(v, prev.ids.length - 1)), updatedAt: Date.now() } : prev
    );
  };

  const finishRun = () => {
    if (!run) return;
    const results: Array<{ id: string; ok: boolean }> = [];
    const wrongIds: string[] = [];
    for (const id of run.ids) {
      const a = run.answers[id];
      if (a === undefined) continue;
      const q = items[id];
      if (!q) continue;
      const c = correctOf(q);
      if (c === null) continue;
      const ok = a === c;
      results.push({ id, ok });
      if (!ok) wrongIds.push(id);
    }
    if (!run.immediate && results.length > 0) {
      // deferred judging: record everything now (immediate mode already recorded per answer)
      setCards((prev) => {
        const n = { ...prev };
        for (const r of results) {
          const cur = n[r.id] ?? { a: 0, c: 0, s: 0, ok: false, t: 0 };
          n[r.id] = { a: cur.a + 1, c: cur.c + (r.ok ? 1 : 0), s: r.ok ? cur.s + 1 : 0, ok: r.ok, t: Date.now() };
        }
        return n;
      });
      postStudy(results);
      if (wrongIds.length > 0) {
        setMistakes((prev) => {
          const n = { ...prev };
          for (const id of wrongIds) n[id] = { wrongCount: (n[id]?.wrongCount ?? 0) + 1, manual: n[id]?.manual ?? false };
          return n;
        });
        postWrongs(wrongIds);
      }
    }
    clearStudySession(userId);
    markDay(userId);
    setReviewFilter("missed");
    setExpanded({});
    setPaletteOpen(false);
    setView("summary");
    window.scrollTo({ top: 0 });
  };

  const retryMissed = () => {
    if (!run) return;
    const missedIds = run.ids.filter((id) => {
      const q = items[id];
      if (!q) return false;
      const c = correctOf(q);
      if (c === null) return false;
      const a = run.answers[id];
      return a === undefined || a !== c;
    });
    if (missedIds.length === 0) return;
    const ids = shuffle(missedIds);
    const order: Record<string, number[]> = {};
    ids.forEach((id) => {
      const q = items[id];
      if (q) order[id] = shuffle(q.options.map((_, oi) => oi));
    });
    beginRun({ ...run, ids, order, answers: {}, idx: 0, elapsed: 0, startedAt: Date.now(), updatedAt: Date.now() }, userId);
  };

  const restartRun = () => {
    if (!run) return;
    const ids = shuffle(run.ids);
    const order: Record<string, number[]> = {};
    ids.forEach((id) => {
      const q = items[id];
      if (q) order[id] = shuffle(q.options.map((_, oi) => oi));
    });
    beginRun({ ...run, ids, order, answers: {}, idx: 0, elapsed: 0, startedAt: Date.now(), updatedAt: Date.now() }, userId);
  };

  const homeFromSummary = () => {
    setRun(null);
    setResumeRec(readStudySession(userId));
    setView("home");
    window.scrollTo({ top: 0 });
  };

  // ── derived run values ──
  const current = run ? items[run.ids[run.idx]] : undefined;
  const runTotal = run ? run.ids.length : 0;
  const runIdx = run ? run.idx : 0;
  const answeredCount = useMemo(() => {
    if (!run) return 0;
    return run.ids.filter((id) => run.answers[id] !== undefined).length;
  }, [run]);
  const okCount = useMemo(() => {
    if (!run) return 0;
    let n = 0;
    for (const id of run.ids) {
      const a = run.answers[id];
      if (a === undefined) continue;
      const q = items[id];
      if (!q) continue;
      const c = correctOf(q);
      if (c !== null && a === c) n++;
    }
    return n;
  }, [run, items, correctOf]);
  const sessionStreak = useMemo(() => {
    if (!run) return 0;
    let st = 0;
    for (const id of run.ids) {
      const a = run.answers[id];
      if (a === undefined) continue;
      const q = items[id];
      if (!q) continue;
      const c = correctOf(q);
      if (c === null) continue;
      st = a === c ? st + 1 : 0;
    }
    return st;
  }, [run, items, correctOf]);
  const bestStreak = useMemo(() => {
    if (!run) return 0;
    let best = 0,
      cur = 0;
    for (const id of run.ids) {
      const a = run.answers[id];
      if (a === undefined) continue;
      const q = items[id];
      if (!q) continue;
      const c = correctOf(q);
      if (c === null) continue;
      if (a === c) {
        cur++;
        if (cur > best) best = cur;
      } else cur = 0;
    }
    return best;
  }, [run, items, correctOf]);

  // keyboard: 1-4 pick an option, Enter/Space next
  useEffect(() => {
    if (view !== "run" || !run) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (paletteOpen) {
        if (e.key === "Escape") setPaletteOpen(false);
        return;
      }
      if (exitConfirm) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (run.idx >= run.ids.length - 1) finishRun();
        else goIdx(run.idx + 1);
        return;
      }
      if (/^[1-6]$/.test(e.key)) {
        const di = Number(e.key) - 1;
        const q = items[run.ids[run.idx]];
        if (!q) return;
        const order = run.order[q.id] ?? q.options.map((_, oi) => oi);
        if (di < order.length) answerCurrent(order[di]);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, run, items, paletteOpen, exitConfirm, immediateOn]);

  const scopeLabel = (rec: StudySession) =>
    rec.main === "all" ? "Бүх ангилал" : rec.sub !== "all" ? `${rec.main} / ${rec.sub}` : rec.main;

  const notifyNote = (id: string, has: boolean) =>
    setNotedIds((prev) => {
      const n = new Set(prev);
      if (has) n.add(id);
      else n.delete(id);
      return n;
    });

  // ─────────────────────────────────────────────────────────────────────────
  // HOME — dashboard
  // ─────────────────────────────────────────────────────────────────────────
  if (view === "home" && sessionStatus === "loading") {
    return <div className="py-24 text-center text-[13px] text-zinc-400 min-h-[100vh]">Ачааллаж байна…</div>;
  }

  if (view === "home") {
    const dataReady = !isAuthed || cardsReady;
    const now = new Date();
    const dateLabel = `${now.getMonth() + 1}-р сарын ${now.getDate()} · ${DAY_SHORT[(now.getDay() + 6) % 7]}`;
    const level =
      readiness >= 80 && accOf(progress) >= 70
        ? { text: "Мэргэшсэн", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" }
        : readiness >= 50
          ? { text: "Дунд шат", cls: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" }
          : readiness >= 20
            ? { text: "Явцтай", cls: "bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300" }
            : { text: "Эхлэл", cls: "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300" };
    const todayKey = dayKey(new Date());
    const dayTodos = todos.filter((t) => t.date === todoDate);
    const todoDone = dayTodos.filter((t) => t.done).length;
    const todoPct = dayTodos.length > 0 ? Math.round((todoDone / dayTodos.length) * 100) : 0;
    const sortedTodos = [...dayTodos].sort((a, b) => Number(a.done) - Number(b.done));
    const mainList = index.mains
      .map((m, i) => ({ mi: i, name: m.name, agg: progress.mainAgg.get(i) }))
      .filter((x): x is { mi: number; name: string; agg: Agg } => !!x.agg && x.agg.total > 0);
    return (
      <div className="mx-auto min-h-[100vh] w-full min-w-0 max-w-6xl px-3 pb-4 sm:px-0">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* ── command strip ── */}
          <section className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:p-5 lg:col-span-3 motion-safe:animate-[riseIn_500ms_cubic-bezier(0.22,1,0.36,1)_both]">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-12 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl dark:bg-indigo-500/25 motion-safe:animate-[orbFloat_13s_ease-in-out_infinite]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl dark:bg-violet-500/25 motion-safe:animate-[orbFloat_17s_ease-in-out_infinite_reverse]"
            />
            <div className="relative flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-x-4">
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 motion-safe:animate-pulse" />
                  Lexlab · Сорилго төв
                </p>
                <h1 className="mt-1 text-balance text-[19px] font-extrabold tracking-tight sm:text-[24px]">
                  {Greeting()} — {dateLabel}
                </h1>
                <p className="mt-0.5 text-pretty text-[11px] text-zinc-500 dark:text-zinc-400 sm:text-xs">
                  Хийх зүйл, халаалтаараа өдрийн суралцах дадлаа үргэлжлүүлээрэй.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {isAuthed && streakDays > 0 && (
                  <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300 sm:text-xs">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                      <path d="M12 2c.4 3.2-1.2 4.6-2.6 6.1C7.8 9.8 6 11.7 6 14.4A6 6 0 0 0 12 20a6 6 0 0 0 6-5.6c0-3.4-2.4-5-3.6-7.2-.5-.9-.8-1.9-.9-2.9-.9.6-1.6 1.6-2 2.7-.4-1.4-.9-2.9-1.5-4.2-.5-1-.8-1.7-1-2.8z" />
                    </svg>
                    {streakDays} өдөр
                  </span>
                )}
                {isAuthed && progress.today > 0 && (
                  <span className="inline-flex min-h-[36px] items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300 sm:text-xs">
                    Өнөөдөр +{progress.today}
                  </span>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={immediateOn}
                  onClick={() => setImmediateOn((v) => !v)}
                  title="Хариулсны дараа тэр дороо шалгах эсвэл төгсгөлд шалгах"
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-2 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5 sm:text-xs"
                >
                  <span
                    className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${immediateOn ? "bg-indigo-600 dark:bg-indigo-500" : "bg-zinc-300 dark:bg-white/20"}`}
                    aria-hidden
                  >
                    <span
                      className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${immediateOn ? "left-[14px]" : "left-0.5"}`}
                    />
                  </span>
                  {immediateOn ? "Шууд шалгах" : "Төгсгөлд шалгах"}
                </button>
              </div>
            </div>
          </section>

          {/* ── to-do list ── */}
          <section className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:p-5 lg:col-span-2 motion-safe:animate-[fadeUp_450ms_ease-out_80ms_both]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold tracking-tight sm:text-lg">Хийх зүйлс</h2>
              </div>
              {dayTodos.length > 0 && (
                <div className="shrink-0 text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Гүйцэтгэсэн</p>
                  <p className="text-[17px] font-extrabold leading-tight tabular-nums">
                    {todoDone}
                    <span className="text-[11px] font-medium text-zinc-400">/{dayTodos.length}</span>
                  </p>
                </div>
              )}
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setTodoDate((d) => shiftDayKey(d, -1))}
                aria-label="Өмнөх өдөр"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-[14px] leading-none text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
              >
                ‹
              </button>
              <p className="min-w-0 truncate text-[12.5px] font-semibold">{dayTitle(todoDate)}</p>
              <button
                type="button"
                onClick={() => setTodoDate((d) => shiftDayKey(d, 1))}
                aria-label="Дараагийн өдөр"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-[14px] leading-none text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
              >
                ›
              </button>
            </div>
            {dayTodos.length > 0 && (
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                  style={{ width: `${todoPct}%` }}
                />
              </div>
            )}
            {resumeRec && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-2.5 dark:border-indigo-400/25 dark:bg-indigo-500/10">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                    ▶ Үргэлжлүүлэх: {scopeLabel(resumeRec)}
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
                    {Object.keys(resumeRec.answers).length}/{resumeRec.ids.length} хариулсан · {TYPE_LABEL[resumeRec.type]} ·{" "}
                    {fmtClock(resumeRec.elapsed)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={discardResume}
                    aria-label="Явцыг устгах"
                    title="Устгах"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 text-[12px] text-indigo-600 transition-colors hover:bg-white dark:border-indigo-400/25 dark:text-indigo-300 dark:hover:bg-white/5"
                  >
                    ✕
                  </button>
                  <button
                    onClick={resumeRun}
                    disabled={preparing !== null}
                    className="inline-flex min-h-[32px] items-center rounded-full bg-indigo-600 px-3.5 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-indigo-500 disabled:opacity-50 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:hover:from-indigo-400 dark:hover:to-violet-400 sm:text-xs"
                  >
                    {preparing === "resume" ? "Бэлдэж байна…" : "Үргэлжлүүлэх"}
                  </button>
                </div>
              </div>
            )}
            {/* add form */}
            <div className="mt-2.5 rounded-2xl border border-dashed border-zinc-200 p-2 dark:border-white/15 sm:p-2.5">
              <div className="grid gap-1.5 sm:grid-cols-2">
                <DropSelect
                  value={todoMain}
                  onChange={(v) => {
                    setTodoMain(v);
                    setTodoSub("all");
                  }}
                  ariaLabel="Үндсэн ангилал"
                  sheetOnMobile
                  buttonClassName="rounded-xl border border-zinc-200 px-3 py-2 text-[12.5px] dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 min-h-[36px]"
                  options={[
                    { value: "all", label: `Бүх ангилал (${preCounts.total})` },
                    ...mainOptions.map((o) => ({
                      value: o.name,
                      label: `${!fullAccess && o.name !== FREE_CATEGORY ? "🔒 " : ""}${o.name} (${o.n})`,
                    })),
                  ]}
                />
                <DropSelect
                  value={todoSub}
                  onChange={(v) => setTodoSub(v)}
                  ariaLabel="Дэд ангилал"
                  sheetOnMobile
                  buttonClassName="rounded-xl border border-zinc-200 px-3 py-2 text-[12.5px] dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 min-h-[36px]"
                  options={[
                    { value: "all", label: `Бүх дэд (${subOptions.reduce((a, [, n]) => a + n, 0)})` },
                    ...subOptions.map(([name, n]) => ({ value: name, label: `${name} (${n})` })),
                  ]}
                />
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <input
                  value={todoText}
                  onChange={(e) => setTodoText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTodo();
                    }
                  }}
                  placeholder="Юу хийх вэ?"
                  className="min-h-[36px] min-w-[120px] flex-1 rounded-xl border border-zinc-200 bg-transparent px-3 text-[12px] text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-indigo-400 dark:border-white/10 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={addTodo}
                  disabled={!todoText.trim() && todoMain === "all" && todoSub === "all"}
                  className="min-h-[36px] shrink-0 rounded-full bg-indigo-600 px-4 py-1.5 text-[11.5px] font-semibold text-white transition-all hover:bg-indigo-500 active:scale-[0.97] disabled:opacity-40 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 sm:text-xs"
                >
                  Нэмэх +
                </button>
              </div>
            </div>
            {/* list */}
            {sortedTodos.length === 0 ? (
              <div className="mt-2.5 rounded-2xl border border-dashed border-zinc-200 p-5 text-center dark:border-white/15">
                <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">{todoDate === todayKey ? "Одоогоор хийх зүйл алга" : "Энэ өдөрт хийх зүйл алга"}</p>
              </div>
            ) : (
              <ul className="mt-2.5 grid gap-1.5">
                {sortedTodos.map((t) => {
                  const scoped = t.main !== "all" || t.sub !== "all";
                  const label = t.text || (t.sub !== "all" ? t.sub : t.main !== "all" ? t.main : "Хийх зүйл");
                  return (
                    <li
                      key={t.id}
                      className={`group flex items-center gap-2 rounded-2xl border p-2 transition-all duration-200 sm:p-2.5 ${
                        t.done
                          ? "border-zinc-200/60 bg-zinc-50/40 opacity-70 dark:border-white/5 dark:bg-white/[0.02]"
                          : "border-zinc-200/80 bg-zinc-50/70 hover:border-indigo-200 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-indigo-400/30"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTodo(t.id)}
                        aria-label={t.done ? "Буцаах" : "Гүйцэтгэх"}
                        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all active:scale-95 ${
                          t.done
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-zinc-300 text-transparent hover:border-indigo-400 hover:text-indigo-300 dark:border-white/25"
                        }`}
                      >
                        ✓
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-[12.5px] font-medium sm:text-[13px] ${t.done ? "text-zinc-400 line-through" : ""}`}
                        >
                          {label}
                        </p>
                        {scoped && (
                          <div className="mt-0.5">
                            <span className="rounded-full bg-white px-2 py-0.5 text-[9.5px] font-semibold text-zinc-500 shadow-sm dark:bg-white/10 dark:text-zinc-300">
                              {t.main === "all" ? "Бүх ангилал" : t.main}
                              {t.sub !== "all" ? ` · ${t.sub}` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                      {scoped && (
                        <button
                          type="button"
                          onClick={() => startSession({ main: t.main, sub: t.sub, type: "smart", all: true })}
                          disabled={preparing !== null}
                          className="min-h-[32px] shrink-0 rounded-full bg-indigo-600 px-3.5 py-1.5 text-[10.5px] font-semibold text-white transition-all hover:bg-indigo-500 active:scale-[0.97] disabled:opacity-40 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 sm:text-[11px]"
                        >
                          Эхлэх ▶
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeTodo(t.id)}
                        aria-label="Устгах"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {todoDone > 0 && (
              <button
                type="button"
                onClick={clearDoneTodos}
                className="mt-2.5 text-[10.5px] text-zinc-400 underline transition-colors hover:text-rose-500 dark:hover:text-rose-400"
              >
                Гүйцэтгэсэнийг цэвэрлэх ({todoDone})
              </button>
            )}
            {!fullAccess && (
              <p className="mt-2.5 text-[10.5px] leading-snug text-zinc-400 sm:text-[11px]">
                🔒 Үнэгүй эрхээр зөвхөн «{FREE_CATEGORY}» —{" "}
                <Link href="/plan" className="underline hover:text-indigo-600 dark:hover:text-indigo-300">
                  Эрх авах
                </Link>{" "}
                бол бүх ангилал нээгдэнэ.
              </p>
            )}
          </section>

          {/* ── readiness ── */}
          <section className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:p-5 lg:col-span-1 motion-safe:animate-[fadeUp_450ms_ease-out_140ms_both]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Бэлэн байдал</p>
            {isAuthed ? (
              <div className="mt-2 flex flex-col items-center">
                <ReadinessRing value={readiness} covered={progress.covered} total={progress.total} />
                <span className={`mt-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${level.cls}`}>{level.text}</span>
              </div>
            ) : (
              <div className="mt-2 flex flex-col items-center">
                <div className="flex h-[118px] w-[118px] flex-col items-center justify-center rounded-full border-2 border-dashed border-zinc-200 dark:border-white/15">
                  <span className="text-3xl font-extrabold leading-none tabular-nums text-indigo-600 dark:text-indigo-300">
                    {progress.total}
                  </span>
                  <span className="mt-1 text-[10px] text-zinc-500">сорилго</span>
                </div>
                <Link
                  href="/login?next=/v2"
                  className="mt-3 inline-flex min-h-[36px] items-center rounded-full bg-indigo-600 px-4 py-2 text-[11px] font-semibold text-white transition-all hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:hover:from-indigo-400 dark:hover:to-violet-400 sm:text-xs"
                >
                  Нэвтрэх →
                </Link>
              </div>
            )}
            {isAuthed && (
              <div className="mt-3 space-y-1.5">
                {[
                  { label: "Суралцсан", value: `${progress.covered}/${progress.total}` },
                  { label: "Эзэмшсэн", value: `${progress.mastered}` },
                  {
                    label: "Нарийвчлал",
                    value: progress.attempts > 0 ? `${Math.round((progress.correct / progress.attempts) * 100)}%` : "—",
                  },
                ].map((r) => (
                  <div
                    key={r.label}
                    className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2 dark:border-white/5 dark:bg-white/[0.03]"
                  >
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{r.label}</span>
                    <span className="text-[12px] font-semibold tabular-nums">{r.value}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── warm-up (live question) ── */}
          <section className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:p-5 lg:col-span-2 motion-safe:animate-[fadeUp_450ms_ease-out_200ms_both]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold tracking-tight sm:text-lg">Халаалт</h2>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 sm:text-xs">
                  Нэг түргэн асуулт — хариугаа тэр дороо шалгаарай.
                </p>
              </div>
              {warm.ids.length > 0 && (
                <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-zinc-500 dark:bg-white/10 dark:text-zinc-300">
                  Зөв: {warm.score}
                </span>
              )}
            </div>
            {warmQ ? (
              <div className="mt-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[11px] font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                    ?
                  </span>
                  <p className="line-clamp-3 text-[12.5px] font-medium leading-relaxed sm:text-[13.5px]">{warmQ.question}</p>
                </div>
                <div className="mt-2.5 grid gap-1.5">
                  {(() => {
                    const c = correctOf(warmQ);
                    return warmQ.options.map((opt, oi) => {
                      const picked = warm.pick === oi;
                      const isCorrect = c !== null && oi === c;
                      const revealed = warm.pick !== null;
                      return (
                        <button
                          key={oi}
                          onClick={() => warmAnswer(oi)}
                          disabled={revealed}
                          className={`flex min-h-[40px] w-full items-center gap-2.5 rounded-2xl border px-3 py-2 text-left text-[12px] leading-snug transition-all sm:text-[12.5px] ${
                            revealed
                              ? isCorrect
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                                : picked
                                  ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200"
                                  : "border-zinc-200 opacity-55 dark:border-white/10"
                              : "border-zinc-200 hover:border-indigo-300 hover:bg-indigo-50/50 active:scale-[0.99] dark:border-white/10 dark:hover:border-indigo-400/30 dark:hover:bg-indigo-500/10"
                          }`}
                        >
                          <span
                            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                              revealed && isCorrect
                                ? "bg-emerald-500 text-white"
                                : revealed && picked
                                  ? "bg-rose-500 text-white"
                                  : "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-300"
                            }`}
                          >
                            {LETTERS[oi]}
                          </span>
                          <span className="line-clamp-2 min-w-0 flex-1">{opt}</span>
                          {revealed && isCorrect && <span className="shrink-0 text-emerald-600 dark:text-emerald-400">✓</span>}
                          {revealed && picked && !isCorrect && <span className="shrink-0 text-rose-600 dark:text-rose-400">✗</span>}
                        </button>
                      );
                    });
                  })()}
                </div>
                {warm.pick !== null &&
                  (() => {
                    const c = correctOf(warmQ);
                    const ok = c !== null && warm.pick === c;
                    return (
                      <div className="mt-2.5 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03] motion-safe:animate-[popIn_220ms_ease-out_both]">
                        <p
                          className={`text-[11.5px] font-semibold ${
                            ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {ok
                            ? "✓ Зөв хариуллаа"
                            : c !== null
                              ? `✗ Буруу — зөв хариулт: ${LETTERS[c]}`
                              : "Энэ асуултын хариу бүртгэгдээгүй байна"}
                        </p>
                        {warmQ.explanation && (
                          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{warmQ.explanation}</p>
                        )}
                        {warmQ.lawRef && (
                          <p className="mt-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-300">{warmQ.lawRef}</p>
                        )}
                        <div className="mt-2.5 flex gap-1.5">
                          <button
                            onClick={warmNext}
                            disabled={preparing !== null}
                            className="min-h-[34px] rounded-full bg-indigo-600 px-4 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-indigo-500 active:scale-[0.97] disabled:opacity-40 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:hover:from-indigo-400 dark:hover:to-violet-400 sm:text-xs"
                          >
                            Дараагийнх →
                          </button>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-[11px] text-zinc-400 dark:border-white/15">
                Асуулт бэлдэж байна…
              </div>
            )}
          </section>

          {/* ── activity ── */}
          <section className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:p-5 lg:col-span-1 motion-safe:animate-[fadeUp_450ms_ease-out_260ms_both]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Идэвх</p>
            {isAuthed ? (
              <>
                <ActivityBars days={activity7} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 dark:border-amber-400/20 dark:bg-amber-400/10">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">Дараалал</p>
                    <p className="text-[15px] font-extrabold tabular-nums text-amber-700 dark:text-amber-200">
                      {streakDays > 0 ? streakDays : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Өнөөдөр</p>
                    <p className="text-[15px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-200">+{progress.today}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-zinc-200 p-4 text-center dark:border-white/15">
                <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Нэвтэрснээр өдрийн идэвх, дараалал хадгалагдана.
                </p>
                <Link
                  href="/login?next=/v2"
                  className="mt-2.5 inline-flex min-h-[36px] items-center rounded-full bg-indigo-600 px-4 py-2 text-[11px] font-semibold text-white transition-all hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 sm:text-xs"
                >
                  Нэвтрэх →
                </Link>
              </div>
            )}
          </section>

          {/* ── mastery map ── */}
          {isAuthed && dataReady && mainList.length > 0 && (
            <section className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:p-5 lg:col-span-3 motion-safe:animate-[fadeUp_500ms_ease-out_320ms_both]">
              <div className="flex items-center justify-end">
                <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
                  {readiness}% бэлэн
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {mainList.map(({ mi, name, agg }) => {
                  const pct = agg.total ? Math.round((agg.solved / agg.total) * 100) : 0;
                  const ready = !!readyMains[name];
                  return (
                    <div
                      key={mi}
                      className={`group min-w-0 rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-600/10 ${
                        ready
                          ? "border-emerald-300/80 bg-emerald-50/50 dark:border-emerald-400/30 dark:bg-emerald-500/10"
                          : "border-zinc-200/80 bg-zinc-50/60 hover:border-indigo-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-indigo-400/40 dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      <button type="button" onClick={() => setMapMain(mi)} className="block w-full text-left">
                        <div className="flex items-start justify-between gap-1.5">
                          <p className="line-clamp-2 min-h-[28px] text-[11px] font-semibold leading-snug sm:text-xs">{name}</p>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums ${
                              pct >= 70
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                                : pct >= 40
                                  ? "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
                                  : pct > 0
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"
                                    : "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400"
                            }`}
                          >
                            {pct}%
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-white/10">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? "bg-emerald-500" : "bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                      <div className="mt-1.5 flex items-center justify-between gap-1.5">
                        <p className="text-[9.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
                          {agg.solved}/{agg.total} · {pct}%
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleReady(name)}
                          aria-pressed={ready}
                          title="Энэ ангилалд бэлэн болсон гэж тэмдэглэх"
                          className={`inline-flex min-h-[24px] items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-all active:scale-[0.97] ${
                            ready
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-zinc-200 text-zinc-400 hover:border-emerald-300 hover:text-emerald-600 dark:border-white/15 dark:text-zinc-400 dark:hover:border-emerald-400/40 dark:hover:text-emerald-300"
                          }`}
                        >
                          ✓ Бэлэн
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── guest: login banner ── */}
          {!isAuthed && (
            <section className="rounded-3xl border border-dashed border-zinc-300 bg-white p-4 dark:border-white/20 dark:bg-white/[0.04] sm:p-5 lg:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold sm:text-sm">Явцаа хадгалаарай</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 sm:text-xs">
                    Нэвтэрснээр суралцсан явц, алдсан сорилгууд тань хадгалагдаж, бүх ангилалд суралцах боломжтой болно.
                  </p>
                </div>
                <Link
                  href="/login?next=/v2"
                  className="inline-flex min-h-[36px] shrink-0 items-center rounded-full bg-indigo-600 px-5 py-2 text-[12px] font-medium text-white shadow-sm shadow-indigo-600/30 transition-all hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:shadow-lg dark:shadow-indigo-950/40 sm:text-sm"
                >
                  Нэвтрэх →
                </Link>
              </div>
            </section>
          )}

          <div className="pb-2 text-center lg:col-span-3">
            <Link
              href="/browse"
              className="text-[11px] text-zinc-400 underline hover:text-indigo-600 dark:hover:text-indigo-300 sm:text-xs"
            >
              Бүх сорилгыг жагсаалтаар үзэх →
            </Link>
          </div>
        </div>

        {/* mastery map modal */}
        {mapMain !== null && index.mains[mapMain] && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <button aria-label="Хаах" onClick={() => setMapMain(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0c0c14]/95 dark:backdrop-blur-xl sm:rounded-3xl motion-safe:animate-[popIn_220ms_ease-out_both]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Ангилал</p>
                  <h3 className="mt-0.5 text-[15px] font-bold tracking-tight sm:text-lg">{index.mains[mapMain].name}</h3>
                </div>
                <button
                  onClick={() => setMapMain(null)}
                  aria-label="Хаах"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5"
                >
                  ✕
                </button>
              </div>
              <p className="mt-2 text-[10.5px] leading-snug text-zinc-500 dark:text-zinc-400">
                Дэд ангилал бүрийн сорилгын тоог тохируулна уу. Тоон дээр дарвал бүгдийг авна.
              </p>
              <div className="mt-3 grid gap-1.5">
                {mapSubs.map((s) => {
                  const key = `${mapMain}\u0001${s.si}`;
                  const mpct = s.agg.total ? Math.round((s.agg.solved / s.agg.total) * 100) : 0;
                  const v = Math.max(0, Math.min(mapPicks[key] ?? 0, s.agg.total));
                  return (
                    <div
                      key={s.si}
                      className="flex min-w-0 items-center gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-2.5 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-semibold sm:text-xs">{s.name}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="h-1 w-full max-w-[120px] overflow-hidden rounded-full bg-zinc-200/70 dark:bg-white/10">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${mpct === 100 ? "bg-emerald-500" : "bg-indigo-400 dark:bg-indigo-500/70"}`}
                              style={{ width: `${mpct}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[9.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
                            {s.agg.solved}/{s.agg.total} · {mpct}%
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setMapPicks((p) => ({ ...p, [key]: Math.max(0, (p[key] ?? 0) - 5) }))}
                          disabled={v <= 0}
                          aria-label="Хасах"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-[13px] text-zinc-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 dark:border-white/15 dark:text-zinc-300 dark:hover:border-indigo-400/40 dark:hover:text-indigo-300"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => setMapPicks((p) => ({ ...p, [key]: s.agg.total }))}
                          title="Бүгдийг авах"
                          aria-label={`Бүгдийг авах — ${s.agg.total}`}
                          className="w-9 min-h-[28px] text-center text-[12px] font-semibold tabular-nums transition-colors hover:text-indigo-600 dark:hover:text-indigo-300"
                        >
                          {v}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMapPicks((p) => ({ ...p, [key]: Math.min(s.agg.total, (p[key] ?? 0) + 5) }))}
                          disabled={v >= s.agg.total}
                          aria-label="Нэмэх"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-[13px] text-zinc-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 dark:border-white/15 dark:text-zinc-300 dark:hover:border-indigo-400/40 dark:hover:text-indigo-300"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMapMain(null);
                          startSession({ main: index.mains[mapMain].name, sub: s.name, type: "smart", n: v });
                        }}
                        disabled={v <= 0 || preparing !== null}
                        aria-label={`${s.name} — ${v} сорилго сурч эхлэх`}
                        title={v > 0 ? `${v} сорилго` : "Тоогоо сонгоно уу"}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-indigo-600 transition-all hover:scale-105 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-40 dark:border-white/15 dark:text-indigo-300 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/15"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                          <path d="M8 5v14l11-7L8 5z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  setMapMain(null);
                  startSession({
                    main: index.mains[mapMain].name,
                    sub: "all",
                    type: "smart",
                    picks: mapSubs
                      .map((s) => ({ sub: s.name, n: Math.max(0, Math.min(mapPicks[`${mapMain}\u0001${s.si}`] ?? 0, s.agg.total)) }))
                      .filter((p) => p.n > 0),
                  });
                }}
                disabled={mapPickedTotal === 0 || preparing !== null}
                className="mt-4 min-h-[42px] w-full rounded-full bg-indigo-600 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-indigo-600/25 transition-all hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-40 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:shadow-lg dark:shadow-indigo-950/40 sm:text-sm"
              >
                {preparing === "start" ? "Бэлдэж байна…" : `Энэ ангиллаар эхлэх — ${mapPickedTotal} сорилго`}
              </button>
            </div>
          </div>
        )}

        {/* paywall notice */}
        {paywallNote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setPaywallNote(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:border dark:border-white/10 dark:bg-[#0c0c14]/95 dark:backdrop-blur-xl">
              <p className="text-3xl">🔒</p>
              <h3 className="mt-2 font-semibold text-[15px] sm:text-lg">Төлбөртэй эрх шаардлагатай</h3>
              <p className="mt-1 text-[12px] text-zinc-500 sm:text-sm">
                Бусад ангиллаар суралцах, явцаа хадгалах нь 39,900₮-ийн бүтэн эрхэд багтдаг.
              </p>
              <Link
                href="/plan"
                className="mt-4 flex min-h-[40px] w-full items-center justify-center rounded-full bg-indigo-600 py-2.5 text-[13px] font-medium text-white shadow-sm shadow-indigo-600/30 transition-all hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:shadow-lg dark:shadow-indigo-950/40 sm:text-sm"
              >
                Эрх авах →
              </Link>
              <button
                onClick={() => setPaywallNote(false)}
                className="mt-2 min-h-[40px] w-full rounded-full border border-zinc-200 py-2.5 text-[13px] transition-colors hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 sm:text-sm"
              >
                Хаах
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RUN — study session
  // ─────────────────────────────────────────────────────────────────────────
  if (view === "run" && run && current) {
    const ans = run.answers[current.id];
    const c = correctOf(current);
    const revealed = run.immediate && ans !== undefined;
    const isOk = revealed && c !== null && ans === c;
    const order = run.order[current.id] ?? current.options.map((_, oi) => oi);
    const correctDi = c === null ? -1 : order.indexOf(c);
    const flagged = !!mistakes[current.id]?.manual;
    const row = rowById.get(current.id);
    const isCase = row ? row[4] === 1 : false;
    const mySavedOnly = c !== null && typeof savedAnswers[current.id] === "number" && fileAnswer(current) === null;
    return (
      <div className="mx-auto max-w-3xl w-full space-y-3 sm:space-y-4 min-w-0 px-3 sm:px-0 max-sm:min-h-[calc(100dvh-12rem)] max-sm:flex max-sm:flex-col max-sm:justify-center">
        {/* top bar */}
        <div className="rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-2.5 sm:p-3.5 dark:border-white/10 dark:bg-white/[0.04] min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              onClick={() => setExitConfirm(true)}
              aria-label="Дасгалаас гарах"
              title="Гарах"
              className="shrink-0 inline-flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-rose-400/10 dark:hover:text-rose-300"
            >
              ✕
            </button>
            <span className="shrink-0 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] sm:text-xs font-bold tabular-nums text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
              {runIdx + 1}
              <span className="mx-0.5 opacity-40">/</span>
              {runTotal}
            </span>
            <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] sm:text-xs font-semibold tabular-nums text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
              ✓ {okCount}
            </span>
            {sessionStreak > 1 && (
              <span className="shrink-0 inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] sm:text-xs font-semibold tabular-nums text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                🔥 {sessionStreak}
              </span>
            )}
            <span className="ml-auto shrink-0 inline-flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] sm:text-xs font-mono font-semibold tabular-nums text-zinc-600 dark:border-white/15 dark:text-zinc-300">
                ⏱ {fmtClock(elapsed)}
              </span>
              <button
                onClick={() => setPaletteOpen(true)}
                aria-label="Сорилгуудын жагсаалт"
                title="Сорилгуудын жагсаалт"
                className="inline-flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-indigo-500/15 dark:hover:border-indigo-400/40 dark:hover:text-indigo-200"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="4" y="4" width="7" height="7" rx="1.5" />
                  <rect x="13" y="4" width="7" height="7" rx="1.5" />
                  <rect x="4" y="13" width="7" height="7" rx="1.5" />
                  <rect x="13" y="13" width="7" height="7" rx="1.5" />
                </svg>
              </button>
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-zinc-100 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 transition-all duration-300"
              style={{ width: `${((runIdx + 1) / runTotal) * 100}%` }}
            />
          </div>
        </div>

        {/* question card */}
        <div
          key={current.id}
          className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-6 dark:border-white/10 dark:bg-white/[0.04] min-w-0 select-none motion-safe:animate-[fadeUp_220ms_ease-out]"
        >
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[12px] sm:text-sm font-extrabold tabular-nums text-white shadow-sm shadow-indigo-600/30 dark:bg-gradient-to-br dark:from-indigo-500 dark:to-violet-500">
              {runIdx + 1}
            </span>
            <span className="shrink-0 rounded-full border border-zinc-200 px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-zinc-500 dark:border-white/15 dark:text-zinc-400">
              {isCase ? "Кейс" : "Онол"}
            </span>
            {current.category && (
              <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-violet-700 dark:bg-violet-400/10 dark:text-violet-300 max-w-[46%] truncate">
                {current.category}
              </span>
            )}
            {current.subCategory && (
              <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-zinc-600 dark:bg-white/5 dark:text-zinc-400 max-w-[34%] truncate">
                {current.subCategory}
              </span>
            )}
            {isAuthed && (
              <button
                onClick={() => toggleFlag(current.id)}
                aria-pressed={flagged}
                title="Дараа дахин давтах жагсаалтад нэмэх"
                className={`ml-auto shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] sm:text-[11px] font-medium transition-colors min-h-[32px] ${
                  flagged
                    ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
                    : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-400 dark:hover:bg-white/5"
                }`}
              >
                ⚑ {flagged ? "Дараа давтах ✓" : "Дараа давтах"}
              </button>
            )}
          </div>
          <div className="mt-2.5 sm:mt-3 rounded-xl border border-violet-200 bg-violet-50/80 border-l-4 border-l-violet-500 px-3 py-3 sm:px-5 sm:py-4 dark:border-violet-400/20 dark:border-l-violet-400/70 dark:bg-violet-500/[0.12]">
            <h2 className="text-[15px] sm:text-xl font-semibold leading-snug sm:leading-relaxed break-words [overflow-wrap:anywhere] min-w-0">
              {current.question}
            </h2>
          </div>

          <div className="mt-3 sm:mt-6 grid gap-1.5 sm:gap-3 min-w-0">
            {order.map((oi, di) => {
              const opt = current.options[oi];
              const selected = ans === oi;
              const isCorrect = c !== null && oi === c;
              let cls = "border-zinc-200 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/5";
              let circleCls = "bg-indigo-50 text-indigo-600 dark:bg-white/5 dark:text-indigo-200";
              if (!revealed) {
                if (selected) {
                  cls = "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-100";
                  circleCls = "bg-white text-indigo-700 dark:bg-white/15 dark:text-indigo-100";
                }
              } else {
                if (isCorrect) {
                  cls = "!border-emerald-500 !bg-emerald-50 !text-emerald-900 dark:!bg-emerald-400/10 dark:!text-emerald-200";
                  circleCls = "!bg-emerald-500 !text-white";
                } else if (selected) {
                  cls = "!border-rose-500 !bg-rose-50 !text-rose-900 dark:!bg-rose-400/10 dark:!text-rose-200";
                  circleCls = "!bg-rose-500 !text-white";
                } else {
                  cls = "border-zinc-200 opacity-60 dark:border-white/10";
                }
              }
              return (
                <button
                  key={oi}
                  onClick={() => answerCurrent(oi)}
                  aria-pressed={selected}
                  className={`text-left rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 flex gap-2 sm:gap-3 text-[13px] sm:text-sm transition-colors min-w-0 overflow-hidden ${cls}`}
                >
                  <span className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold ${circleCls}`}>
                    {LETTERS[di]}
                  </span>
                  <span className="flex-1 min-w-0 break-words [overflow-wrap:anywhere] leading-snug">{opt}</span>
                  {revealed && isCorrect && <span className="shrink-0 self-center text-[11px] sm:text-xs font-bold">✓</span>}
                  {revealed && selected && !isCorrect && <span className="shrink-0 self-center text-[11px] sm:text-xs font-bold">✗</span>}
                </button>
              );
            })}
          </div>

          {/* instant feedback */}
          {revealed && (
            <div
              className={`mt-3 sm:mt-4 rounded-xl border p-3 sm:p-4 motion-safe:animate-[popIn_180ms_ease-out] ${
                isOk
                  ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-400/25 dark:bg-emerald-400/[0.08]"
                  : "border-rose-200 bg-rose-50/70 dark:border-rose-400/25 dark:bg-rose-400/[0.08]"
              }`}
            >
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] sm:text-sm font-semibold">
                <span className={isOk ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                  {isOk ? "✓ Зөв!" : "✗ Буруу"}
                </span>
                {!isOk && correctDi >= 0 && (
                  <span className="font-normal text-zinc-600 dark:text-zinc-400">
                    Зөв хариулт: <b className="font-bold">{LETTERS[correctDi]}</b>
                  </span>
                )}
              </p>
              {(current.explanation || current.lawRef) && (
                <div className="mt-2 space-y-1.5 border-t border-black/5 pt-2 dark:border-white/10">
                  {current.explanation && (
                    <p className="text-[12px] sm:text-[13px] leading-relaxed break-words">
                      <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Тайлбар</span>
                      {current.explanation}
                    </p>
                  )}
                  {current.lawRef && (
                    <p className="text-[12px] sm:text-[13px] leading-relaxed break-words">
                      <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Хуулийн зүйл</span>
                      <span className="font-medium">{current.lawRef}</span>
                    </p>
                  )}
                </div>
              )}
              {mySavedOnly && (
                <p className="mt-2 text-[10px] sm:text-[11px] text-zinc-500">
                  Энэ хариулт нь таны хувийн хадгалсан хариулт — албан ёсны түлхүүр байхгүй.
                </p>
              )}
            </div>
          )}

          {/* actions */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <QuestionNote questionId={current.id} initialHas={notedIds.has(current.id)} onChange={notifyNote} />
            <QuestionReport questionId={current.id} />
          </div>

          {/* nav */}
          <div className="mt-4 sm:mt-6 min-w-0">
            <div className="sticky bottom-2 sm:bottom-3 z-10 mx-auto flex w-full max-w-md items-center gap-2 rounded-full border border-zinc-200 bg-white/95 p-1.5 shadow-lg shadow-zinc-900/5 backdrop-blur dark:border-white/10 dark:bg-[#0c0c14]/90 dark:shadow-black/40">
              <button
                onClick={() => goIdx(runIdx - 1)}
                disabled={runIdx === 0}
                className="flex-1 sm:flex-none shrink-0 rounded-full border border-zinc-200 px-4 py-2 sm:py-1.5 text-[13px] disabled:opacity-40 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[40px] sm:min-h-[36px]"
              >
                Өмнөх
              </button>
              {runIdx === runTotal - 1 ? (
                <button
                  onClick={finishRun}
                  className="flex-1 sm:flex-none sm:ml-auto shrink-0 rounded-full bg-indigo-600 px-5 py-2 sm:py-1.5 text-[13px] font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px] sm:min-h-[36px]"
                >
                  Дүн харах
                </button>
              ) : (
                <button
                  onClick={() => goIdx(runIdx + 1)}
                  className="flex-1 sm:flex-none sm:ml-auto shrink-0 rounded-full bg-indigo-600 px-5 py-2 sm:py-1.5 text-[13px] font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px] sm:min-h-[36px]"
                >
                  {run.immediate && ans === undefined && c !== null ? "Алгасах" : "Дараах"}
                </button>
              )}
            </div>
            {answeredCount > 0 && runIdx < runTotal - 1 && (
              <div className="mt-2 text-center">
                <button
                  onClick={finishRun}
                  className="text-[11px] sm:text-xs underline text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  Дасгалыг дуусгах ({answeredCount}/{runTotal} хариулсан)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* palette modal */}
        {paletteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setPaletteOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60" />
            <div className="relative w-full max-w-md sm:max-w-lg rounded-2xl bg-white p-4 sm:p-6 shadow-xl dark:border dark:border-white/10 dark:bg-[#0c0c14]/95 dark:backdrop-blur-xl motion-safe:animate-[bellIn_160ms_ease-out]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-semibold text-[14px] sm:text-base">Сорилгууд</h3>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300 tabular-nums">
                    {answeredCount} / {runTotal} хариулсан
                  </span>
                </div>
                <button
                  onClick={() => setPaletteOpen(false)}
                  aria-label="Хаах"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-[13px] text-zinc-500 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5"
                >
                  ✕
                </button>
              </div>
              <div className="mt-3 sm:mt-4 max-h-[58vh] overflow-y-auto overscroll-contain pr-0.5">
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 sm:gap-2">
                  {run.ids.map((id, i) => {
                    const a = run.answers[id];
                    const q = items[id];
                    const cc = q ? correctOf(q) : null;
                    const isAnswered = a !== undefined;
                    const cellOk = isAnswered && cc !== null && a === cc;
                    const isCurrent = i === runIdx;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          goIdx(i);
                          setPaletteOpen(false);
                        }}
                        aria-label={`Сорилго ${i + 1}`}
                        className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-[12px] sm:text-[13px] font-semibold tabular-nums border transition-colors min-w-0 ${
                          isAnswered
                            ? cellOk
                              ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-400 dark:bg-emerald-500/90 dark:border-emerald-400/50"
                              : "bg-rose-500 border-rose-500 text-white hover:bg-rose-400 dark:bg-rose-500/90 dark:border-rose-400/50"
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
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Зөв
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Буруу
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-indigo-500 ring-1 ring-indigo-300 dark:ring-indigo-400/40" /> Одоогийн
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-zinc-300 dark:border-white/25" /> Үлдсэн · {runTotal - answeredCount}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* exit confirm */}
        {exitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setExitConfirm(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-xl dark:bg-[#0c0c14]/95 dark:border dark:border-white/10 dark:backdrop-blur-xl">
              <h3 className="font-semibold text-[14px] sm:text-base">Дасгалаас гарах уу?</h3>
              <p className="mt-2 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">
                Явц хадгалагдана — самбар дээрээс «Үргэлжлүүлэх» товчоор буцаж суралцах боломжтой.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setExitConfirm(false)}
                  className="rounded-full border border-zinc-200 px-5 py-2 text-[13px] sm:text-sm dark:border-white/15 min-h-[36px]"
                >
                  Үргэлжлүүлэх
                </button>
                <button
                  onClick={exitRun}
                  className="rounded-full bg-indigo-600 px-5 py-2 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[36px]"
                >
                  Гарах
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  if (view === "summary" && run) {
    const answered = okCount + run.ids.filter((id) => {
      const a = run.answers[id];
      if (a === undefined) return false;
      const q = items[id];
      if (!q) return false;
      const cc = correctOf(q);
      return cc !== null && a !== cc;
    }).length;
    const pct = answered > 0 ? Math.round((okCount / answered) * 100) : 0;
    const wrongCount = answered - okCount;
    const unansweredCount = runTotal - answered;
    const ring = 2 * Math.PI * 54;
    const missedIds = run.ids.filter((id) => {
      const q = items[id];
      if (!q) return false;
      const cc = correctOf(q);
      if (cc === null) return false;
      const a = run.answers[id];
      return a === undefined || a !== cc;
    });
    const statusOf = (id: string): "correct" | "wrong" | "unanswered" | "unknown" => {
      const q = items[id];
      if (!q) return "unknown";
      const cc = correctOf(q);
      if (cc === null) return "unknown";
      const a = run.answers[id];
      if (a === undefined) return "unanswered";
      return a === cc ? "correct" : "wrong";
    };
    const effFilter = wrongCount + unansweredCount > 0 ? reviewFilter : "all";
    const reviewItems = run.ids
      .map((id, i) => ({ id, i, st: statusOf(id) }))
      .filter(({ st }) =>
        effFilter === "all" ? true : effFilter === "correct" ? st === "correct" : st === "wrong" || st === "unanswered"
      );
    const allOpen = reviewItems.length > 0 && reviewItems.every(({ id }) => expanded[id]);
    const dotCls = (st: string) =>
      st === "correct"
        ? "bg-emerald-600 text-white dark:bg-emerald-500"
        : st === "wrong"
          ? "bg-rose-600 text-white dark:bg-rose-500"
          : st === "unanswered"
            ? "bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300"
            : "bg-amber-400 text-white";
    const dotSym = (st: string) => (st === "correct" ? "✓" : st === "wrong" ? "✗" : st === "unanswered" ? "○" : "?");
    const catBreakdown = (() => {
      const map = new Map<string, { ok: number; tot: number }>();
      for (const id of run.ids) {
        const q = items[id];
        if (!q) continue;
        const cc = correctOf(q);
        if (cc === null) continue;
        const a = run.answers[id];
        if (a === undefined) continue;
        const key = q.subCategory ? `${q.category ?? ""} / ${q.subCategory}` : q.category ?? "Бусад";
        const e = map.get(key) ?? { ok: 0, tot: 0 };
        e.tot++;
        if (a === cc) e.ok++;
        map.set(key, e);
      }
      return [...map.entries()].sort((a, b) => collator.compare(a[0], b[0]));
    })();
    return (
      <div className="mx-auto max-w-3xl w-full space-y-3 sm:space-y-6 min-w-0 overflow-hidden px-3 sm:px-0">
        {/* result dashboard */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 sm:p-8 dark:border-white/10 dark:bg-white/[0.04] min-w-0">
          <div
            aria-hidden
            className={`pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl ${pct >= 60 ? "bg-emerald-500/10" : "bg-rose-500/10"}`}
          />
          <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-8 motion-safe:animate-[popIn_260ms_ease-out]">
            <div className="relative shrink-0">
              <svg viewBox="0 0 120 120" className="h-28 w-28 sm:h-36 sm:w-36 -rotate-90" aria-hidden>
                <circle cx="60" cy="60" r="54" fill="none" strokeWidth="10" className="stroke-zinc-100 dark:stroke-white/10" />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  className={pct >= 60 ? "stroke-emerald-500" : "stroke-rose-500"}
                  strokeDasharray={ring}
                  strokeDashoffset={ring * (1 - Math.max(Math.min(pct, 100), 0) / 100)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl sm:text-4xl font-extrabold tabular-nums leading-none">{pct}%</p>
                <p className="mt-0.5 text-[10px] sm:text-xs text-zinc-500">
                  {okCount} / {answered}
                </p>
              </div>
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">
                {wrongCount + unansweredCount === 0 ? "Бүгд зөв! 🎉" : "Дүн"}
              </h1>
              <p className="mt-1 text-[12px] sm:text-sm text-zinc-500 truncate">{scopeLabel(run)} · {TYPE_LABEL[run.type]}</p>
              <div className="mt-1.5 sm:mt-2 flex flex-wrap justify-center sm:justify-start gap-1.5">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">
                  ✓ Зөв · {okCount}
                </span>
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-rose-600 dark:bg-rose-400/10 dark:text-rose-400">
                  ✗ Буруу · {wrongCount}
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                  ○ Хариулаагүй · {unansweredCount}
                </span>
                {bestStreak > 1 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                    🔥 Дараалал · {bestStreak}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[12px] sm:text-sm text-zinc-500">
                ⏱ {fmtClock(elapsed)} зарцуулсан · {runTotal} сорилго
              </p>
            </div>
          </div>

          {catBreakdown.length > 1 && (
            <div className="mt-4 sm:mt-5 grid gap-1.5 sm:gap-2 text-left">
              {catBreakdown.map(([name, v]) => {
                const p = v.tot ? Math.round((v.ok / v.tot) * 100) : 0;
                return (
                  <div key={name} className="min-w-0">
                    <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                      <span className="truncate text-zinc-600 dark:text-zinc-400">{name}</span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {v.ok}/{v.tot} · {p}%
                      </span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded-full bg-zinc-100 dark:bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p >= 70 ? "bg-emerald-500" : p >= 40 ? "bg-amber-400" : "bg-rose-500"}`}
                        style={{ width: `${p}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 sm:mt-6 flex flex-wrap justify-center gap-2">
            {missedIds.length > 0 && (
              <button
                onClick={retryMissed}
                className="rounded-full bg-indigo-600 px-5 py-2 sm:px-6 sm:py-3 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[36px]"
              >
                Алдсанаа дахин сурах — {missedIds.length}
              </button>
            )}
            <button
              onClick={restartRun}
              className="rounded-full border border-zinc-200 px-5 py-2 sm:px-6 sm:py-3 text-[13px] sm:text-sm font-medium hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[36px]"
            >
              Дахин эхлэх
            </button>
            <button
              onClick={homeFromSummary}
              className="rounded-full border border-zinc-200 px-5 py-2 sm:px-6 sm:py-3 text-[13px] sm:text-sm font-medium hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[36px]"
            >
              ← Самбар
            </button>
          </div>
        </div>

        {/* review list */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5">
          <span className="text-[12px] sm:text-sm font-medium shrink-0 mr-1">Шалгах:</span>
          {(
            [
              { k: "missed", label: `Алдсан · ${wrongCount + unansweredCount}` },
              { k: "all", label: `Бүгд · ${runTotal}` },
              { k: "correct", label: `Зөв · ${okCount}` },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setReviewFilter(t.k)}
              className={`shrink-0 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-[12px] sm:text-sm border min-h-[32px] sm:min-h-[36px] transition-colors ${
                effFilter === t.k
                  ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25"
                  : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => {
              if (allOpen) setExpanded({});
              else {
                const o: Record<string, boolean> = {};
                reviewItems.forEach(({ id }) => {
                  o[id] = true;
                });
                setExpanded((p) => ({ ...p, ...o }));
              }
            }}
            className="shrink-0 ml-auto text-[11px] sm:text-xs underline text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300"
          >
            {allOpen ? "Бүгдийг хураах" : "Бүгдийг нээх"}
          </button>
        </div>

        <div className="space-y-2 sm:space-y-4 min-w-0 select-none">
          {reviewItems.map(({ id, i, st }) => {
            const q = items[id];
            if (!q) return null;
            const a = run.answers[id];
            const cc = correctOf(q);
            const open = !!expanded[id];
            const oi2order = run.order[id] ?? q.options.map((_, oi) => oi);
            const ok = st === "correct";
            const unknown = st === "unknown";
            return (
              <div
                key={id}
                className={`rounded-xl sm:rounded-2xl border min-w-0 overflow-hidden ${
                  unknown
                    ? "bg-zinc-50 border-zinc-200 dark:bg-white/[0.04] dark:border-white/10"
                    : ok
                      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-400/10 dark:border-emerald-400/30"
                      : "bg-rose-50 border-rose-200 dark:bg-rose-400/10 dark:border-rose-400/30"
                }`}
              >
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [id]: !p[id] }))}
                  className="w-full flex items-center gap-2 p-3 sm:p-4 text-left min-w-0"
                >
                  <span
                    className={`flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold ${dotCls(st)}`}
                  >
                    {dotSym(st)}
                  </span>
                  <span className="text-zinc-400 text-[11px] sm:text-sm shrink-0">{i + 1}.</span>
                  <span className={`flex-1 min-w-0 text-[13px] sm:text-sm leading-snug break-words ${open ? "" : "line-clamp-2"}`}>
                    {q.question}
                  </span>
                  <span className="text-zinc-400 text-xs shrink-0">{open ? "▾" : "▸"}</span>
                </button>
                {open && (
                  <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                    <p className="text-[10px] sm:text-xs text-zinc-500 break-words">
                      {q.category}
                      {q.subCategory ? ` · ${q.subCategory}` : ""} {st === "unanswered" ? "· хариулаагүй" : ""}
                    </p>
                    <div className="mt-2 grid gap-1.5 sm:gap-2 min-w-0">
                      {oi2order.map((oi, di) => (
                        <div
                          key={oi}
                          className={`rounded-lg sm:rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 text-[12px] sm:text-sm flex gap-1.5 sm:gap-2 min-w-0 overflow-hidden ${
                            !unknown && oi === cc ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-400/10" : ""
                          } ${oi === a && !ok && !unknown ? "border-rose-500 bg-rose-100 dark:bg-rose-400/10" : "bg-white dark:bg-white/5"}`}
                        >
                          <span className="font-bold shrink-0">{LETTERS[di]}.</span>
                          <span className="flex-1 min-w-0 break-words [overflow-wrap:anywhere] leading-snug">
                            {q.options[oi]} {!unknown && oi === cc && "✓"} {oi === a && oi !== cc && !unknown && "← таны сонголт"}
                          </span>
                        </div>
                      ))}
                    </div>
                    {(q.explanation || q.lawRef) && (
                      <div className="mt-2 rounded-lg sm:rounded-xl border border-zinc-200 bg-white/70 p-2.5 sm:p-3 space-y-1 dark:border-white/10 dark:bg-white/[0.03]">
                        {q.explanation && (
                          <p className="text-[11.5px] sm:text-[13px] leading-relaxed break-words">
                            <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Тайлбар</span>
                            {q.explanation}
                          </p>
                        )}
                        {q.lawRef && (
                          <p className="text-[11.5px] sm:text-[13px] leading-relaxed break-words">
                            <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Хуулийн зүйл</span>
                            <span className="font-medium">{q.lawRef}</span>
                          </p>
                        )}
                      </div>
                    )}
                    {isAuthed && (st === "wrong" || st === "unanswered") && (
                      <div className="mt-2">
                        {mistakes[id]?.manual ? (
                          <p className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-400">
                            ⚑ «Дараа давтах» жагсаалтад байна
                            {mistakes[id].wrongCount > 0 ? ` · ✗ ${mistakes[id].wrongCount}` : ""}
                          </p>
                        ) : (
                          <button
                            onClick={() => toggleFlag(id)}
                            className="rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] sm:text-xs font-medium hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[36px]"
                          >
                            ⚑ Дараа давтах жагсаалтад нэмэх
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {reviewItems.length === 0 && (
            <p className="text-center py-8 text-[13px] sm:text-sm text-zinc-500">Бүгд зөв — мундаг! 🎉</p>
          )}
        </div>

        <div className="flex justify-center gap-2 pb-2">
          <button
            onClick={homeFromSummary}
            className="rounded-full border border-zinc-200 px-5 py-2 text-[13px] sm:text-sm font-medium hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[36px]"
          >
            ← Самбар
          </button>
          <button
            onClick={restartRun}
            className="rounded-full bg-indigo-600 px-6 py-2 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[36px]"
          >
            Дахин эхлэх
          </button>
        </div>
      </div>
    );
  }

  if (view === "run") {
    return <div className="py-24 text-center text-[13px] text-zinc-400 min-h-[100vh]">Ачааллаж байна…</div>;
  }

  return null;
}
