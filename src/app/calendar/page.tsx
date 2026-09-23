"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { EXAM, daysUntilExam, examPhase } from "@/lib/exam";
import { fetchQuestionsByIds } from "@/lib/fetchQuestionsByIds";
import { lockScrollRoot } from "@/lib/scrollRoot";

type AttemptItem = { id: string; category: string; mode: string; score: number; total: number; createdAt: string; questionIds?: string[] };
type NoteItem = { questionId: string; content: string; createdAt: string };
type SavedItem = { questionId: string; createdAt: string };
type CommentItem = { questionId: string; content: string; createdAt: string };

const UB = "Asia/Ulaanbaatar";
const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: UB, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const dayTime = (iso: string) =>
  new Intl.DateTimeFormat("mn-MN", { timeZone: UB, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const todayKey = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: UB, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const WEEKDAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];
const modeLabel = (m: string) => (m === "study" ? "Сургалт" : "Шалгалт");

function monthCells(year: number, month: number): (number | null)[] {
  // Monday-first grid
  const first = new Date(year, month, 1).getDay(); // 0=Sun
  const lead = (first + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const isAuthed = !!session?.user;
  const now = new Date();
  const [base, setBase] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [questionsById, setQuestionsById] = useState<Record<string, string> | null>(null);

  const cur = useMemo(() => ({ y: base.y, m: base.m }), [base]);

  useEffect(() => {
    if (status === "loading" || !isAuthed) return;
    const from = `${cur.y}-${String(cur.m + 1).padStart(2, "0")}-01`;
    const last = new Date(cur.y, cur.m + 1, 0).getDate();
    const to = `${cur.y}-${String(cur.m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    fetch(`/api/activity?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : { attempts: [], notes: [], comments: [], saved: [] }))
      .then((d) => {
        setAttempts(d.attempts || []);
        setNotes(d.notes || []);
        setComments(d.comments || []);
        setSaved(d.saved || []);
      })
      .catch(() => {});
  }, [isAuthed, status, cur]);

  // modal: Escape close + scroll lock
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", onKey);
    const unlock = lockScrollRoot();
    return () => { document.removeEventListener("keydown", onKey); unlock(); };
  }, [selected]);

  // lazy-load question texts for the selected day only (light ids payload)
  const loadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!selected) return;
    const ids = [
      ...new Set([
        ...attempts.filter((a) => dayKey(a.createdAt) === selected).flatMap((a) => a.questionIds || []),
        ...notes.filter((n) => dayKey(n.createdAt) === selected).map((n) => n.questionId),
        ...comments.filter((c) => dayKey(c.createdAt) === selected).map((c) => c.questionId),
        ...saved.filter((s) => dayKey(s.createdAt) === selected).map((s) => s.questionId),
      ]),
    ];
    const missing = ids.filter((id) => !loadedRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => loadedRef.current.add(id));
    fetchQuestionsByIds(missing, { texts: true })
      .then((list) => {
        const add: Record<string, string> = {};
        list.forEach((q) => (add[q.id] = q.question));
        setQuestionsById((p) => ({ ...(p || {}), ...add }));
      })
      .catch(() => {});
  }, [selected, attempts, notes, comments, saved]);

  const byDay = useMemo(() => {
    const map: Record<string, { attempts: AttemptItem[]; notes: NoteItem[]; comments: CommentItem[]; saved: SavedItem[] }> = {};
    const put = (iso: string, kind: "attempts" | "notes" | "comments" | "saved", item: never) => {
      const k = dayKey(iso);
      (map[k] ??= { attempts: [], notes: [], comments: [], saved: [] })[kind].push(item as never);
    };
    attempts.forEach((a) => put(a.createdAt, "attempts", a as never));
    notes.forEach((n) => put(n.createdAt, "notes", n as never));
    comments.forEach((c) => put(c.createdAt, "comments", c as never));
    saved.forEach((s) => put(s.createdAt, "saved", s as never));
    return map;
  }, [attempts, notes, comments, saved]);

  const qText = (qid: string) => {
    const t = questionsById?.[qid];
    return t ? (t.length > 80 ? t.slice(0, 80) + "…" : t) : qid;
  };

  if (status === "loading") {
    // Same shell as the loaded page (stable height) so content arrival causes no layout shift.
    return (
      <main className="mx-auto max-w-md sm:max-w-xl px-3 sm:px-6 py-4 sm:py-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-9 w-9 rounded-full border border-zinc-200 dark:border-white/15" />
          <h1 className="text-base sm:text-xl font-bold">{cur.y} оны {cur.m + 1}-р сар</h1>
          <div className="h-9 w-9 rounded-full border border-zinc-200 dark:border-white/15" />
        </div>
        {examPhase() !== "done" && (
          <div className="mb-4 h-11 w-full rounded-2xl border border-zinc-200 dark:border-white/10 dark:bg-white/[0.04]" />
        )}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">{w}</div>
          ))}
          {monthCells(cur.y, cur.m).map((d, i) => (
            <div key={i} className={`aspect-square rounded-xl border border-zinc-200 dark:border-white/10 ${d === null ? "border-transparent dark:border-transparent" : ""}`} />
          ))}
        </div>
      </main>
    );
  }
  if (!isAuthed) {
    return (
      <main className="mx-auto max-w-6xl px-3 sm:px-6 py-8">
        <div className="mx-auto max-w-sm rounded-3xl border border-zinc-200 p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Календар харахын тулд нэвтэрнэ үү.</p>
          <Link href="/login" className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-indigo-600 px-6 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400">
            Нэвтрэх
          </Link>
        </div>
      </main>
    );
  }

  const sel = selected ? byDay[selected] : null;
  const shift = (d: number) => {
    const dt = new Date(base.y, base.m + d, 1);
    setBase({ y: dt.getFullYear(), m: dt.getMonth() });
    setSelected(null);
  };
  const jumpToExam = () => {
    setBase({ y: EXAM.examStartMonth.y, m: EXAM.examStartMonth.m });
    setSelected(null);
  };
  const phase = examPhase();
  const left = daysUntilExam();
  const countdown =
    phase === "done" ? null
    : left > 1 ? `Шалгалт эхлэхэд ${left} хоног үлдлээ`
    : left === 1 ? "Шалгалт маргааш эхэлнэ"
    : left === 0 ? "Шалгалт өнөөдөр эхэлж байна"
    : "Шалгалт явагдаж байна";

  return (
    <main className="mx-auto max-w-md sm:max-w-xl px-3 sm:px-6 py-4 sm:py-8">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => shift(-1)} aria-label="өмнөх сар" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 dark:border-white/15 hover:bg-zinc-50 dark:hover:bg-white/5">‹</button>
        <h1 className="text-base sm:text-xl font-bold">{cur.y} оны {cur.m + 1}-р сар</h1>
        <button onClick={() => shift(1)} aria-label="дараах сар" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 dark:border-white/15 hover:bg-zinc-50 dark:hover:bg-white/5">›</button>
      </div>

      {countdown && (
        <button
          onClick={jumpToExam}
          className="mb-4 w-full rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10 px-4 py-2.5 text-center hover:bg-amber-100 dark:hover:bg-amber-400/15"
        >
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{countdown}</p>
        </button>
      )}

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">{w}</div>
        ))}
        {monthCells(cur.y, cur.m).map((d, i) => {
          if (d === null) return <div key={i} />;
          const k = `${cur.y}-${String(cur.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const info = byDay[k];
          const active = !!info && (info.attempts.length + info.notes.length + info.comments.length + info.saved.length > 0);
          const isToday = k === todayKey();
          const isExam = EXAM.examDayKeys.includes(k);
          return (
            <button
              key={i}
              disabled={!active}
              onClick={() => setSelected(k)}
              className={`aspect-square overflow-hidden rounded-xl border p-1 sm:p-1.5 text-left align-top transition-colors dark:border-white/10 ${
                active ? "border-zinc-400 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 cursor-pointer" : "border-zinc-200 dark:border-white/10"
              } ${isToday ? "ring-1 ring-indigo-500 dark:ring-indigo-400" : ""} ${
                isExam ? "border-amber-400 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10" : ""
              }`}
            >
              <div className={`text-sm font-bold ${isExam ? "text-amber-700 dark:text-amber-300" : active ? "" : "text-zinc-400 dark:text-zinc-600"}`}>{d}</div>
              {isExam && <div className="truncate text-[9px] font-semibold leading-tight text-amber-700 dark:text-amber-300">Шалгалт</div>}
              {info && (
                <div className="mt-0.5 space-y-0.5 text-[10px] leading-tight text-zinc-600 dark:text-zinc-300">
                  {info.attempts.length > 0 && <div className="truncate">▦ {info.attempts.length}</div>}
                  {info.notes.length > 0 && <div className="truncate">✎ {info.notes.length}</div>}
                  {info.comments.length > 0 && <div className="truncate">❝ {info.comments.length}</div>}
                  {info.saved.length > 0 && <div className="truncate">✓ {info.saved.length}</div>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
        <span>▦ Шалгалт өгсөн</span>
        <span>✎ Тэмдэглэл</span>
        <span>❝ Сэтгэгдэл</span>
        <span>✓ Хадгалсан сорилго</span>
        <span className="font-medium text-amber-700 dark:text-amber-300">🟡 Шалгалтын өдөр</span>
      </div>

      {selected && sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white dark:bg-[#0c0c14]/95 dark:border-white/10 dark:backdrop-blur-xl p-4 sm:p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold">{selected}</h3>
              <button onClick={() => setSelected(null)} aria-label="хаах" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 dark:border-white/15 hover:bg-zinc-50 dark:hover:bg-white/5">✕</button>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-zinc-100 dark:bg-white/5 px-2.5 py-1 font-medium">▦ {sel.attempts.length}</span>
              <span className="rounded-full bg-zinc-100 dark:bg-white/5 px-2.5 py-1 font-medium">✎ {sel.notes.length}</span>
              <span className="rounded-full bg-zinc-100 dark:bg-white/5 px-2.5 py-1 font-medium">❝ {sel.comments.length}</span>
              <span className="rounded-full bg-zinc-100 dark:bg-white/5 px-2.5 py-1 font-medium">✓ {sel.saved.length}</span>
            </div>
            <div className="space-y-2.5 text-[13px] sm:text-sm">
              <details className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10">
                <summary className="flex min-h-[44px] cursor-pointer items-center justify-between px-3 py-2 font-semibold">
                  <span>▦ Шалгалт</span>
                  <span className="rounded-full bg-zinc-100 dark:bg-white/5 px-2 py-0.5 text-xs font-medium">{sel.attempts.length}</span>
                </summary>
                {sel.attempts.length === 0 ? <p className="border-t border-zinc-200 dark:border-white/10 px-3 py-2 text-zinc-500">Хоосон</p> : (
                  <ul className="grid grid-cols-2 gap-2 border-t border-zinc-200 dark:border-white/10 p-2">
                    {sel.attempts.map((a) => (
                      <li key={a.id} className="rounded-xl border border-zinc-200 dark:border-white/15 px-2.5 py-2">
                        <p className="font-medium">{a.category}</p>
                        <dl className="mt-1 grid grid-cols-[52px_1fr] gap-x-2 gap-y-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                          <dt className="text-zinc-500">Төрөл</dt><dd>{modeLabel(a.mode)}</dd>
                          <dt className="text-zinc-500">Оноо</dt><dd>{a.score}/{a.total}</dd>
                          <dt className="text-zinc-500">Цаг</dt><dd>{dayTime(a.createdAt)}</dd>
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
              <details className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10">
                <summary className="flex min-h-[44px] cursor-pointer items-center justify-between px-3 py-2 font-semibold">
                  <span>✎ Тэмдэглэл</span>
                  <span className="rounded-full bg-zinc-100 dark:bg-white/5 px-2 py-0.5 text-xs font-medium">{sel.notes.length}</span>
                </summary>
                {sel.notes.length === 0 ? <p className="border-t border-zinc-200 dark:border-white/10 px-3 py-2 text-zinc-500">Хоосон</p> : (
                  <ul className="grid grid-cols-2 gap-2 border-t border-zinc-200 dark:border-white/10 p-2">
                    {sel.notes.map((n, i) => (
                      <li key={i} className="rounded-xl border border-zinc-200 dark:border-white/15 px-2.5 py-2">
                        <p className="font-medium">{qText(n.questionId)}</p>
                        <p className="mt-1 border-l-2 border-zinc-300 dark:border-white/20 pl-2 text-zinc-700 dark:text-zinc-200">“{n.content}”</p>
                        <p className="mt-1 text-xs text-zinc-500">{dayTime(n.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
              <details className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10">
                <summary className="flex min-h-[44px] cursor-pointer items-center justify-between px-3 py-2 font-semibold">
                  <span>❝ Сэтгэгдэл</span>
                  <span className="rounded-full bg-zinc-100 dark:bg-white/5 px-2 py-0.5 text-xs font-medium">{sel.comments.length}</span>
                </summary>
                {sel.comments.length === 0 ? <p className="border-t border-zinc-200 dark:border-white/10 px-3 py-2 text-zinc-500">Хоосон</p> : (
                  <ul className="grid grid-cols-2 gap-2 border-t border-zinc-200 dark:border-white/10 p-2">
                    {sel.comments.map((c, i) => (
                      <li key={i} className="rounded-xl border border-zinc-200 dark:border-white/15 px-2.5 py-2">
                        <p className="font-medium">{qText(c.questionId)}</p>
                        <p className="mt-1 border-l-2 border-zinc-300 dark:border-white/20 pl-2 text-zinc-700 dark:text-zinc-200">“{c.content}”</p>
                        <p className="mt-1 text-xs text-zinc-500">{dayTime(c.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
              <details className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10">
                <summary className="flex min-h-[44px] cursor-pointer items-center justify-between px-3 py-2 font-semibold">
                  <span>✓ Хадгалсан</span>
                  <span className="rounded-full bg-zinc-100 dark:bg-white/5 px-2 py-0.5 text-xs font-medium">{sel.saved.length}</span>
                </summary>
                {sel.saved.length === 0 ? <p className="border-t border-zinc-200 dark:border-white/10 px-3 py-2 text-zinc-500">Хоосон</p> : (
                  <ul className="grid grid-cols-2 gap-2 border-t border-zinc-200 dark:border-white/10 p-2">
                    {sel.saved.map((s, i) => (
                      <li key={i} className="rounded-xl border border-zinc-200 dark:border-white/15 px-2.5 py-2">
                        <p className="font-medium">{qText(s.questionId)}</p>
                        <p className="mt-1 text-xs text-zinc-500">{dayTime(s.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
