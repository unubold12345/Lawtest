"use client";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import Link from "next/link";
import { fetchQuestionsByIds } from "@/lib/fetchQuestionsByIds";
import { lockScrollRoot } from "@/lib/scrollRoot";

type ErrorRow = { id: string; file: string; category: string; subCategory: string; question: string; optionsCount: number; answer: number | null; reason: string };
type RecentUser = { id: string; phone: string | null; email: string; role: string; createdAt: string };
type RecentAttempt = { id: string; category: string; mode: string; score: number; total: number; createdAt: string; user: { phone: string | null; email: string } | null };

type Stats = {
  questions: { total: number; byMain: Record<string, number>; sources: { file: string; count: number }[]; errors: ErrorRow[] };
  users: number;
  attempts: number;
  comments: number;
  saved: number;
  otps: number;
  recentUsers?: RecentUser[];
  recentAttempts?: RecentAttempt[];
};

type UserRow = { id: string; phone: string | null; email: string; role: string; paidAt: string | null; createdAt: string; _count: { attempts: number; comments: number } };

type PaymentRow = { id: string; status: string; createdAt: string; decidedAt: string | null; user: { id: string; name: string | null; phone: string | null; email: string; paidAt: string | null } };

type ReportRow = { id: string; questionId: string; type: string; message: string; status: string; createdAt: string; user: { id: string; name: string | null; email: string; phone: string | null } };

type TabId = "overview" | "users" | "questions" | "attempts" | "reports" | "payments";

const REPORT_TYPES: Record<string, string> = {
  WRONG_ANSWER: "Зөв хариулт буруу",
  WRONG_OPTIONS: "Сонголтууд буруу / дутуу",
  QUESTION_ERROR: "Сорилгын текстэнд алдаа",
  OTHER: "Бусад",
};

const SECTIONS: { id: TabId; label: string; desc: string }[] = [
  { id: "overview", label: "Тойм", desc: "Ерөнхий үзүүлэлт, сүүлийн идэвх" },
  { id: "users", label: "Хэрэглэгчид", desc: "Эрх, төлбөртэй хандалт удирдах" },
  { id: "payments", label: "Төлбөр", desc: "Төлбөрийн хүсэлтүүдийг баталгаажуулах" },
  { id: "attempts", label: "Оролдлогууд", desc: "Хэрэглэгчдийн шалгалтын үр дүн" },
  { id: "questions", label: "Сорилгууд", desc: "Асуултын сан, чанарын хяналт" },
  { id: "reports", label: "Мэдээлэл", desc: "Хэрэглэгчдийн мэдээлсэн алдаа" },
];

const ICONS: Record<TabId, ReactNode> = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5" />
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19" />
    </svg>
  ),
  attempts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  questions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <ellipse cx="12" cy="5" rx="8" ry="2.8" />
      <path d="M4 5v14c0 1.55 3.6 2.8 8 2.8s8-1.25 8-2.8V5" />
      <path d="M4 12c0 1.55 3.6 2.8 8 2.8s8-1.25 8-2.8" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M5 3v18" />
      <path d="M5 4h13l-2.5 4L18 12H5" />
    </svg>
  ),
};

function NavItem({ active, icon, label, badge, tone = "rose", onClick }: { active: boolean; icon: ReactNode; label: string; badge?: number; tone?: "amber" | "rose"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"}`}
    >
      <span className={active ? "" : "text-zinc-400 dark:text-zinc-500"}>{icon}</span>
      <span className="truncate">{label}</span>
      {!!badge && badge > 0 && (
        <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${tone === "amber" ? "bg-amber-500" : "bg-rose-500"}`}>{badge}</span>
      )}
    </button>
  );
}

function AlertCard({ tone, title, desc, cta, onClick }: { tone: "amber" | "indigo" | "rose"; title: string; desc: string; cta: string; onClick: () => void }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10",
    indigo: "border-indigo-200 bg-indigo-50 dark:border-indigo-400/30 dark:bg-indigo-400/10",
    rose: "border-rose-200 bg-rose-50 dark:border-rose-400/30 dark:bg-rose-400/10",
  };
  return (
    <button onClick={onClick} className={`rounded-2xl border p-4 text-left transition hover:brightness-[1.02] dark:hover:bg-white/[0.06] ${tones[tone]}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">{desc}</p>
      <span className="mt-2 inline-block text-xs font-medium text-indigo-600 dark:text-indigo-300">{cta}</span>
    </button>
  );
}

const PAGE_SIZE = 20;
const SRC_PAGE_SIZE = 10;

function Pager({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const cur = Math.min(Math.max(1, page), pages);
  const from = (cur - 1) * pageSize + 1;
  const to = Math.min(total, cur * pageSize);
  const nums: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - cur) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const btn = "flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-xs font-medium transition";
  const idle = "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/15 dark:bg-white/[0.04] dark:hover:bg-white/10";
  const active = "border-transparent bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25";
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] text-zinc-500 sm:text-xs">{from}–{to} / {total}</p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(cur - 1)} disabled={cur === 1} aria-label="Өмнөх хуудас" className={`${btn} ${idle} disabled:opacity-40`}>‹</button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1 text-xs text-zinc-400">…</span>
          ) : (
            <button key={n} type="button" onClick={() => onChange(n)} aria-current={n === cur ? "page" : undefined} className={`${btn} ${n === cur ? active : idle}`}>{n}</button>
          )
        )}
        <button type="button" onClick={() => onChange(cur + 1)} disabled={cur === pages} aria-label="Дараах хуудас" className={`${btn} ${idle} disabled:opacity-40`}>›</button>
      </div>
    </div>
  );
}

type EditableQuestion = {
  id: string;
  question: string;
  options: string[];
  answer?: number | number[] | null;
  explanation?: string;
  lawRef?: string;
  source?: string;
};

const optionLetter = (i: number) => String.fromCharCode(65 + i);

const editorInput = "w-full rounded-xl border border-zinc-200 px-3 py-2 text-[13px] sm:text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 disabled:opacity-50";
const editorPick = "border-transparent bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25";
const editorIdle = "border-zinc-200 dark:border-white/15";
const editorPrimary =
  "rounded-full bg-indigo-600 px-5 py-2.5 text-xs font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-40 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px]";
const editorGhost = "rounded-full border border-zinc-200 px-5 py-2.5 text-xs font-medium hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 min-h-[40px]";

function AutoGrowTextarea({ value, onChange, disabled, className }: { value: string; onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void; disabled?: boolean; className?: string }) {
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

function QuestionEditor({ report, onClose, onSaved }: { report: ReportRow; onClose: () => void; onSaved: (questionId: string, newText: string, resolved: boolean) => void }) {
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const found = await fetchQuestionsByIds([report.questionId]);
        if (!alive) return;
        const one = found[0] as EditableQuestion | undefined;
        if (!one) {
          setLoadErr("Сорилго олдсонгүй — id хуучирсан эсвэл файл устсан байна.");
          return;
        }
        setQ(one);
        setQuestion(one.question);
        setOptions(one.options);
        setAnswer(typeof one.answer === "number" ? one.answer : null);
        setExplanation(one.explanation || "");
        setLawRef(one.lawRef || "");
      } catch {
        if (alive) setLoadErr("Ачаалж чадсангүй");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [report.questionId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const unlock = lockScrollRoot();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlock();
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
      if (resolve && report.status === "OPEN") {
        try {
          const rr = await fetch(`/api/admin/reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "RESOLVED" }) });
          resolved = rr.ok;
        } catch { /* the edit is saved; report stays open */ }
      }
      setResolvedOk(resolved);
      setDone(true);
      onSaved(q.id, question.trim(), resolved);
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
            <p className="truncate font-mono text-[10px] text-zinc-500">{report.questionId}</p>
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
              {resolve && report.status === "OPEN" && (
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
              <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-xs">
                <input type="checkbox" checked={resolve} onChange={(e) => setResolve(e.target.checked)} className="h-4 w-4" />
                Хадгалсны дараа мэдээллийг «Шийдэгдсэн» болгох
              </label>
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

export default function AdminClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [attemptsTotal, setAttemptsTotal] = useState(0);
  const [attemptsPage, setAttemptsPage] = useState(1);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsPage, setReportsPage] = useState(1);
  const [srcPage, setSrcPage] = useState(1);
  const [openReports, setOpenReports] = useState(0);
  const [reportFilter, setReportFilter] = useState<"OPEN" | "RESOLVED" | "all">("OPEN");
  const [tab, setTab] = useState<TabId>("overview");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [paymentFilter, setPaymentFilter] = useState<"PENDING" | "all">("PENDING");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [reportQ, setReportQ] = useState<Record<string, string>>({});
  const [editReport, setEditReport] = useState<ReportRow | null>(null);

  const fetchStats = async () => {
    const r = await fetch("/api/admin/stats");
    if (!r.ok) throw new Error((await r.json()).error || "stats failed");
    setStats(await r.json());
  };
  const fetchUsers = async (search = q) => {
    const r = await fetch(`/api/admin/users?q=${encodeURIComponent(search)}`);
    if (!r.ok) throw new Error("users failed");
    const d = await r.json();
    setUsers(d.users);
  };
  const fetchAttempts = async (p = attemptsPage) => {
    const r = await fetch(`/api/admin/attempts?page=${p}&pageSize=${PAGE_SIZE}`);
    if (!r.ok) throw new Error("attempts failed");
    const d = await r.json();
    setAttempts(d.attempts);
    setAttemptsTotal(d.total);
    setAttemptsPage(d.page);
  };
  const fetchReports = async (f = reportFilter, p = reportsPage) => {
    const r = await fetch(`/api/admin/reports?status=${f === "all" ? "" : f}&page=${p}&pageSize=${PAGE_SIZE}`);
    if (!r.ok) throw new Error("reports failed");
    const d = await r.json();
    setReports(d.reports);
    setReportsTotal(d.total);
    setReportsPage(d.page);
    setOpenReports(d.open);
  };
  const fetchPayments = async (f = paymentFilter) => {
    const r = await fetch(`/api/admin/payments${f === "all" ? "" : `?status=${f}`}`);
    if (!r.ok) throw new Error("payments failed");
    const d = await r.json();
    setPayments(d.requests);
    setPendingPayments(d.pending);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([fetchStats(), fetchUsers(""), fetchAttempts(), fetchReports("OPEN"), fetchPayments("PENDING")]);
      } catch (e: any) {
        setErr(e.message || "Алдаа");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const ids = [...new Set(reports.map((r) => r.questionId).filter(Boolean))];
    if (ids.length === 0) { setReportQ({}); return; }
    let alive = true;
    (async () => {
      try {
        const qs = await fetchQuestionsByIds(ids, { texts: true });
        if (!alive) return;
        const m: Record<string, string> = {};
        for (const x of qs) m[x.id] = x.question;
        setReportQ(m);
      } catch { /* keep placeholders */ }
    })();
    return () => { alive = false; };
  }, [reports]);

  const select = (id: TabId) => {
    setTab(id);
    setNavOpen(false);
    if (id === "reports") fetchReports();
    if (id === "payments") fetchPayments();
  };

  const setReportStatus = async (id: string, status: "OPEN" | "RESOLVED") => {
    const r = await fetch(`/api/admin/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!r.ok) { alert("Амжилтгүй"); return; }
    const leaves = !(reportFilter === "all" || reportFilter === status);
    await fetchReports(reportFilter, leaves && reports.length === 1 && reportsPage > 1 ? reportsPage - 1 : reportsPage);
  };
  const delReport = async (id: string) => {
    if (!confirm("Мэдээллийг устгах уу?")) return;
    const r = await fetch(`/api/admin/reports/${id}`, { method: "DELETE" });
    if (!r.ok) { alert("Амжилтгүй"); return; }
    await fetchReports(reportFilter, reports.length === 1 && reportsPage > 1 ? reportsPage - 1 : reportsPage);
  };

  const toggleRole = async (u: UserRow) => {
    const next = u.role === "ADMIN" ? "USER" : "ADMIN";
    if (!confirm(`${u.phone || u.email} → ${next} болгох уу?`)) return;
    const r = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, role: next }) });
    if (!r.ok) { alert("Амжилтгүй"); return; }
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: next } : x)));
  };
  const togglePaid = async (u: UserRow) => {
    const next = !u.paidAt;
    if (!confirm(`${u.phone || u.email} → төлбөртэй эрх ${next ? "НЭЭХ" : "ХААХ"} уу?`)) return;
    const r = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, paid: next }) });
    if (!r.ok) { alert("Амжилтгүй"); return; }
    const d = await r.json();
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, paidAt: d.user.paidAt } : x)));
  };
  const decidePayment = async (id: string, action: "approve" | "reject") => {
    if (!confirm(action === "approve" ? "Төлбөр баталгаажиж, эрхийг НЭЭХ үү?" : "Хүсэлтийг татгалзах уу?")) return;
    const r = await fetch("/api/admin/payments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    if (!r.ok) { alert("Амжилтгүй"); return; }
    fetchPayments();
    fetchUsers();
  };
  const delUser = async (u: UserRow) => {
    if (!confirm(`${u.phone || u.email} устгах уу?`)) return;
    const r = await fetch(`/api/admin/users?id=${u.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); alert(d.error || "Устгаж чадсангүй"); return; }
    setUsers((prev) => prev.filter((x) => x.id !== u.id));
  };

  if (loading) return <div className="mx-auto max-w-7xl px-3 sm:px-6 py-8"><p className="text-sm text-zinc-500">Ачаалж байна…</p></div>;
  if (err) return <div className="mx-auto max-w-7xl px-3 sm:px-6 py-8"><p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 dark:bg-rose-400/10 dark:border-rose-400/30 dark:text-rose-400">{err}</p></div>;

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const current = SECTIONS.find((s) => s.id === tab) || SECTIONS[0];
  const errCount = stats?.questions.errors?.length || 0;
  const maxMain = stats ? Math.max(1, ...Object.values(stats.questions.byMain)) : 1;
  const sourcesSorted = stats ? [...stats.questions.sources].sort((a, b) => collator.compare(a.file, b.file)) : [];
  const srcPages = Math.max(1, Math.ceil(sourcesSorted.length / SRC_PAGE_SIZE));
  const srcSafe = Math.min(Math.max(1, srcPage), srcPages);
  const srcRows = sourcesSorted.slice((srcSafe - 1) * SRC_PAGE_SIZE, srcSafe * SRC_PAGE_SIZE);
  const navMeta: Record<TabId, { badge: number; tone: "amber" | "rose" }> = {
    overview: { badge: 0, tone: "rose" },
    users: { badge: 0, tone: "rose" },
    payments: { badge: pendingPayments, tone: "amber" },
    attempts: { badge: 0, tone: "rose" },
    questions: { badge: errCount, tone: "rose" },
    reports: { badge: openReports, tone: "rose" },
  };

  const navList = (onPick: (id: TabId) => void) => (
    <nav className="grid gap-1">
      {SECTIONS.map((s) => (
        <NavItem key={s.id} active={tab === s.id} icon={ICONS[s.id]} label={s.label} badge={navMeta[s.id].badge} tone={navMeta[s.id].tone} onClick={() => onPick(s.id)} />
      ))}
    </nav>
  );

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-6 sm:py-8">
      {/* mobile top bar */}
      <div className="flex items-center gap-3 lg:hidden">
        <button onClick={() => setNavOpen(true)} aria-label="Цэс нээх" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white dark:border-white/15 dark:bg-white/[0.04]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Админ</p>
          <h1 className="truncate text-lg font-bold leading-tight">{current.label}</h1>
        </div>
        <Link href="/" aria-label="Нүүр" className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white dark:border-white/15 dark:bg-white/[0.04]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>
        </Link>
      </div>

      {/* mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Хаах" onClick={() => setNavOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative flex h-full w-72 max-w-[82%] flex-col overflow-y-auto border-r border-zinc-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#0c0c14]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Админ панель</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Lexlab удирдлага</p>
              </div>
              <button onClick={() => setNavOpen(false)} aria-label="Хаах" className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 dark:border-white/15">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <div className="mt-4 flex-1">{navList(select)}</div>
            <div className="mt-4 grid gap-1.5 border-t border-zinc-200 pt-4 dark:border-white/10">
              <Link href="/" className="rounded-full border border-zinc-200 px-4 py-2 text-center text-xs hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5">Нүүр</Link>
              <Link href="/browse" className="rounded-full border border-zinc-200 px-4 py-2 text-center text-xs hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5">Сорилго</Link>
            </div>
          </div>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* desktop sidebar */}
        <aside className="hidden lg:sticky lg:top-24 lg:flex lg:flex-col lg:rounded-2xl lg:border lg:border-zinc-200 lg:bg-white lg:p-3 dark:lg:border-white/10 dark:lg:bg-white/[0.04]">
          <div className="px-2 pb-3 pt-1">
            <p className="text-sm font-bold">Админ панель</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Lexlab удирдлага</p>
          </div>
          {navList(select)}
          <div className="mt-3 grid gap-1.5 border-t border-zinc-200 pt-3 dark:border-white/10">
            <Link href="/" className="rounded-full border border-zinc-200 px-4 py-2 text-center text-xs hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5">Нүүр</Link>
            <Link href="/browse" className="rounded-full border border-zinc-200 px-4 py-2 text-center text-xs hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5">Сорилго</Link>
          </div>
        </aside>

        <main className="mt-4 min-w-0 lg:mt-0">
          <div className="hidden lg:flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{current.label}</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{current.desc}</p>
            </div>
          </div>

          {tab === "overview" && stats && (
            <div className="grid gap-4 lg:mt-4">
              {(pendingPayments > 0 || openReports > 0 || errCount > 0) && (
                <div className="grid gap-2 sm:grid-cols-3">
                  {pendingPayments > 0 && <AlertCard tone="amber" title={`${pendingPayments} төлбөр хүлээгдэж байна`} desc="Баталгаажуулбал хэрэглэгчийн эрх нээгдэнэ" cta="Төлбөр рүү →" onClick={() => select("payments")} />}
                  {openReports > 0 && <AlertCard tone="indigo" title={`${openReports} мэдээлэл нээлттэй`} desc="Хэрэглэгчдийн мэдээлсэн алдааг шалгана уу" cta="Мэдээлэл рүү →" onClick={() => select("reports")} />}
                  {errCount > 0 && <AlertCard tone="rose" title={`${errCount} алдаатай сорилго`} desc="Хариулт эсвэл сонголтын тоо буруу байна" cta="Сорилгууд руу →" onClick={() => select("questions")} />}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:bg-white/[0.04] dark:border-white/10"><p className="text-2xl font-bold">{stats.questions.total}</p><p className="text-xs text-zinc-500">Сорилго</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:bg-white/[0.04] dark:border-white/10"><p className="text-2xl font-bold">{stats.users}</p><p className="text-xs text-zinc-500">Хэрэглэгч</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:bg-white/[0.04] dark:border-white/10"><p className="text-2xl font-bold">{stats.attempts}</p><p className="text-xs text-zinc-500">Оролдлого</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:bg-white/[0.04] dark:border-white/10"><p className="text-2xl font-bold">{stats.comments}</p><p className="text-xs text-zinc-500">Сэтгэгдэл</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:bg-white/[0.04] dark:border-white/10"><p className="text-2xl font-bold">{stats.saved}</p><p className="text-xs text-zinc-500">Хадгалсан хариу</p></div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:bg-white/[0.04] dark:border-white/10"><p className="text-2xl font-bold">{stats.otps}</p><p className="text-xs text-zinc-500">OTP</p></div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:bg-white/[0.04] dark:border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm">Сүүлийн хэрэглэгчид</h3>
                    <button onClick={() => select("users")} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">Бүгдийг →</button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(stats.recentUsers || []).map((u) => (
                      <div key={u.id} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-white/5">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs">{u.phone || u.email}</p>
                          <p className="text-[11px] text-zinc-500">{new Date(u.createdAt).toLocaleDateString("mn-MN")}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${u.role === "ADMIN" ? "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300" : "bg-zinc-100 dark:bg-white/5"}`}>{u.role}</span>
                      </div>
                    ))}
                    {(stats.recentUsers || []).length === 0 && <p className="py-4 text-center text-sm text-zinc-500">Хэрэглэгч алга</p>}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:bg-white/[0.04] dark:border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm">Сүүлийн оролдлогууд</h3>
                    <button onClick={() => select("attempts")} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">Бүгдийг →</button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(stats.recentAttempts || []).map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-white/5">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs">{a.user?.phone || a.user?.email || "—"}</p>
                          <p className="truncate text-[11px] text-zinc-500">{a.category} · {new Date(a.createdAt).toLocaleDateString("mn-MN")}</p>
                        </div>
                        <b className="shrink-0 text-xs">{a.score}/{a.total}</b>
                      </div>
                    ))}
                    {(stats.recentAttempts || []).length === 0 && <p className="py-4 text-center text-sm text-zinc-500">Оролдлого алга</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:bg-white/[0.04] dark:border-white/10">
                <h3 className="font-semibold text-sm">Ангиллаар (main)</h3>
                <div className="mt-3 grid gap-3">
                  {Object.entries(stats.questions.byMain).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="truncate">{k}</span>
                        <b className="shrink-0">{v}</b>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${Math.round((v / maxMain) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "users" && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:bg-white/[0.04] dark:border-white/10">
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') fetchUsers(); }} placeholder="Хайх: утас / имэйл" className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 sm:py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[44px]" />
                <button onClick={()=>fetchUsers()} className="rounded-full bg-indigo-600 px-5 py-3 sm:py-2.5 text-sm text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[44px]">Хайх</button>
              </div>
              <div className="mt-4 hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-zinc-500 text-xs"><th className="text-left py-2">Утас / Имэйл</th><th className="text-left py-2">Role</th><th className="text-left py-2">Бүртгүүлсэн</th><th className="text-left py-2">Шалгалт / Сэтгэгдэл</th><th className="text-right py-2">Үйлдэл</th></tr></thead>
                  <tbody>
                    {users.map(u=>(
                      <tr key={u.id} className="border-t border-zinc-200 dark:border-white/10">
                        <td className="py-2"><div className="font-mono text-xs">{u.phone || "—"}</div><div className="text-xs text-zinc-500 truncate max-w-[220px]">{u.email}</div></td>
                        <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role==='ADMIN' ? 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300' : 'bg-zinc-100 dark:bg-white/5'}`}>{u.role}</span>{u.paidAt && <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">💰 Эрхтэй</span>}</td>
                        <td className="py-2 text-xs text-zinc-500">{new Date(u.createdAt).toLocaleDateString("mn-MN")}</td>
                        <td className="py-2 text-xs">{u._count.attempts} / {u._count.comments}</td>
                        <td className="py-2 text-right flex gap-1 justify-end">
                          <button onClick={()=>togglePaid(u)} className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5">{u.paidAt ? 'Эрх хаах' : 'Эрх нээх'}</button>
                          <button onClick={()=>toggleRole(u)} className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5">{u.role==='ADMIN' ? 'USER болгох' : 'ADMIN болгох'}</button>
                          <button onClick={()=>delUser(u)} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-400 dark:hover:bg-rose-400/10">Устгах</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-2 sm:hidden">
                {users.map(u=>(
                  <div key={u.id} className="rounded-xl border border-zinc-200 p-3 dark:border-white/10">
                    <div className="flex justify-between gap-2"><span className="font-mono text-xs truncate">{u.phone || u.email}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${u.role==='ADMIN'?'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300':'bg-zinc-100 dark:bg-white/5'}`}>{u.role}{u.paidAt ? ' · 💰' : ''}</span></div>
                    <p className="text-xs text-zinc-500 break-all">{u.email}</p>
                    <p className="text-xs text-zinc-500 mt-1">{new Date(u.createdAt).toLocaleDateString("mn-MN")} · {u._count.attempts} шалгалт · {u._count.comments} сэтгэгдэл</p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={()=>togglePaid(u)} className="flex-1 rounded-full border border-zinc-200 py-2 text-xs dark:border-white/15 min-h-[40px]">{u.paidAt ? 'Эрх хаах' : 'Эрх нээх'}</button>
                      <button onClick={()=>toggleRole(u)} className="flex-1 rounded-full border border-zinc-200 py-2 text-xs dark:border-white/15 min-h-[40px]">{u.role==='ADMIN' ? 'USER болгох' : 'ADMIN болгох'}</button>
                      <button onClick={()=>delUser(u)} className="rounded-full border border-rose-200 px-4 py-2 text-xs text-rose-600 min-h-[40px] dark:border-rose-400/30 dark:text-rose-400">Устгах</button>
                    </div>
                  </div>
                ))}
                {users.length===0 && <p className="text-sm text-zinc-500 text-center py-6">Хэрэглэгч алга</p>}
              </div>
            </div>
          )}

          {tab === "questions" && stats && (
            <div className="mt-4 grid gap-4">
            {(stats.questions.errors?.length || 0) > 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5 dark:bg-rose-400/10 dark:border-rose-400/30">
                <h3 className="font-semibold text-sm text-rose-700 dark:text-rose-300">Алдаатай сорилго ({stats.questions.errors.length})</h3>
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">Хариултын индекс буруу эсвэл 4-өөс өөр сонголттой — JSON файл дээр нь засаарай. Файл тус бүрээр бүлэглэв.</p>
                <div className="mt-3 space-y-2">
                  {Object.entries(
                    stats.questions.errors.reduce<Record<string, ErrorRow[]>>((m, r) => {
                      (m[r.file] = m[r.file] || []).push(r);
                      return m;
                    }, {})
                  )
                    .sort(([a], [b]) => collator.compare(a, b))
                    .map(([file, rows]) => (
                    <details key={file} className="overflow-hidden rounded-xl border border-rose-200 bg-white dark:bg-white/[0.04] dark:border-rose-400/30">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm min-h-[44px]">
                        <span className="break-all font-medium">{file}</span>
                        <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-medium text-white">{rows.length}</span>
                      </summary>
                      <div className="space-y-2 border-t border-rose-100 p-3 dark:border-rose-400/30">
                        {rows.map((r) => (
                          <div key={`${r.file}::${r.id}`}>
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-medium text-white">{r.reason}</span>
                              <span className="font-mono text-[10px] text-zinc-500">{r.id} · {r.optionsCount} сонголт</span>
                            </div>
                            <p className="mt-1.5 text-[13px] font-medium leading-snug break-words">{r.question}</p>
                            {r.subCategory ? <p className="mt-1 text-[11px] text-zinc-500 break-all">{r.subCategory}</p> : null}
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:bg-white/[0.04] dark:border-white/10">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Нийт {stats.questions.total} сорилго. Жагсаалтыг дэлгэрэнгүй харах бол <Link href="/browse" className="underline">Бүх сорилго</Link> руу орно уу. Доор файл тус бүрээр харуулав.</p>
              <div className="mt-3 space-y-2">
                {srcRows.map(s=>(
                  <div key={s.file} className="flex justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-white/10"><span className="break-all">{s.file}</span><b className="shrink-0">{s.count}</b></div>
                ))}
              </div>
              <Pager page={srcSafe} pageSize={SRC_PAGE_SIZE} total={sourcesSorted.length} onChange={setSrcPage} />
            </div>
            </div>
          )}

          {tab === "reports" && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:bg-white/[0.04] dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-sm">Хэрэглэгчдийн мэдээлсэн алдаа{openReports > 0 ? ` · ${openReports} нээлттэй` : ""}</h3>
                <div className="flex gap-1.5">
                  {(["OPEN", "RESOLVED", "all"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => { setReportFilter(f); fetchReports(f, 1); }}
                      className={`rounded-full border px-3 py-1.5 text-[11px] sm:text-xs min-h-[32px] ${reportFilter === f ? "bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 dark:border-white/15"}`}
                    >
                      {f === "OPEN" ? "Нээлттэй" : f === "RESOLVED" ? "Шийдэгдсэн" : "Бүгд"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                {reports.map((r) => (
                  <div key={r.id} className="rounded-xl border border-zinc-200 p-3 dark:border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.status === "OPEN" ? "bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"}`}>
                          {r.status === "OPEN" ? "Нээлттэй" : "Шийдэгдсэн"}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] dark:bg-white/5">{REPORT_TYPES[r.type] || r.type}</span>
                      </div>
                      <span className="font-mono text-[10px] text-zinc-500 break-all">{r.questionId}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-snug break-words whitespace-pre-wrap">{r.message}</p>
                    <div className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-white/5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Сорилго</p>
                      <p className="mt-0.5 text-[12px] leading-snug break-words">{reportQ[r.questionId] || "…"}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">{r.user?.phone || r.user?.name || r.user?.email} · {new Date(r.createdAt).toLocaleString("mn-MN")}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button onClick={() => setEditReport(r)} className="rounded-full border border-zinc-200 px-4 py-1.5 text-[11px] sm:text-xs min-h-[32px] hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5">✎ Сорилго засах</button>
                      {r.status === "OPEN" ? (
                        <button onClick={() => setReportStatus(r.id, "RESOLVED")} className="rounded-full bg-indigo-600 px-4 py-1.5 text-[11px] sm:text-xs text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[32px]">Шийдэгдсэн болгох</button>
                      ) : (
                        <button onClick={() => setReportStatus(r.id, "OPEN")} className="rounded-full border border-zinc-200 px-4 py-1.5 text-[11px] sm:text-xs dark:border-white/15 min-h-[32px]">Дахин нээх</button>
                      )}
                      <button onClick={() => delReport(r.id)} className="rounded-full border border-rose-200 px-4 py-1.5 text-[11px] sm:text-xs text-rose-600 dark:border-rose-400/30 dark:text-rose-400 min-h-[32px]">Устгах</button>
                    </div>
                  </div>
                ))}
                {reports.length === 0 && <p className="text-sm text-zinc-500 text-center py-6">Мэдээлэл алга</p>}
              </div>
              <Pager page={reportsPage} pageSize={PAGE_SIZE} total={reportsTotal} onChange={(p) => fetchReports(reportFilter, p)} />
            </div>
          )}

          {tab === "attempts" && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:bg-white/[0.04] dark:border-white/10">
              <h3 className="font-semibold text-sm">Сүүлийн оролдлогууд</h3>
              <div className="mt-3 overflow-x-auto hidden sm:block">
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-zinc-500"><th className="text-left py-2">Хэрэглэгч</th><th className="text-left py-2">Ангилал</th><th className="text-left py-2">Оноо</th><th className="text-left py-2">Огноо</th></tr></thead>
                  <tbody>
                    {attempts.map((a:any)=>(
                      <tr key={a.id} className="border-t border-zinc-200 dark:border-white/10">
                        <td className="py-2 font-mono text-xs">{a.user?.phone || a.user?.email}</td>
                        <td className="py-2 text-xs">{a.category} · {a.mode}</td>
                        <td className="py-2 text-xs">{a.score}/{a.total}</td>
                        <td className="py-2 text-xs text-zinc-500">{new Date(a.createdAt).toLocaleString("mn-MN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 grid gap-2 sm:hidden">
                {attempts.map((a:any)=>(
                  <div key={a.id} className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-white/10">
                    <div className="flex justify-between"><span className="font-mono text-xs">{a.user?.phone || a.user?.email}</span><b className="text-xs">{a.score}/{a.total}</b></div>
                    <p className="text-xs text-zinc-500">{a.category} · {a.mode} · {new Date(a.createdAt).toLocaleString("mn-MN")}</p>
                  </div>
                ))}
                {attempts.length===0 && <p className="text-sm text-zinc-500 text-center py-6">Оролдлого алга</p>}
              </div>
              <Pager page={attemptsPage} pageSize={PAGE_SIZE} total={attemptsTotal} onChange={(p) => fetchAttempts(p)} />
            </div>
          )}

          {tab === "payments" && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:bg-white/[0.04] dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-sm">Төлбөрийн хүсэлтүүд{pendingPayments > 0 ? ` · ${pendingPayments} хүлээгдэж буй` : ""}</h3>
                <div className="flex gap-1.5">
                  {(["PENDING", "all"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => { setPaymentFilter(f); fetchPayments(f); }}
                      className={`rounded-full border px-3 py-1.5 text-[11px] sm:text-xs min-h-[32px] ${paymentFilter === f ? "bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 dark:border-white/15"}`}
                    >
                      {f === "PENDING" ? "Хүлээгдэж буй" : "Бүгд"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-[11px] sm:text-xs text-zinc-500">Хэрэглэгч QR-аар 39,900₮ төлсний дараа хүсэлт илгээдэг — төлбөрийг шалгаад эрхийг нээнэ үү.</p>
              <div className="mt-3 grid gap-2">
                {payments.map((p) => (
                  <div key={p.id} className="rounded-xl border border-zinc-200 p-3 dark:border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-mono text-xs">{p.user?.phone || p.user?.email}</span>
                      <div className="flex items-center gap-1.5">
                        {p.user?.paidAt && <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">💰 Эрхтэй</span>}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.status === "PENDING" ? "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300" : p.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"}`}>
                          {p.status === "PENDING" ? "Хүлээгдэж буй" : p.status === "APPROVED" ? "Зөвшөөрсөн" : "Татгалзсан"}
                        </span>
                      </div>
                    </div>
                    {p.user?.name && <p className="text-xs text-zinc-500">{p.user.name}</p>}
                    <p className="mt-1 text-[11px] text-zinc-500">{new Date(p.createdAt).toLocaleString("mn-MN")}</p>
                    {p.status === "PENDING" && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button onClick={() => decidePayment(p.id, "approve")} className="rounded-full bg-indigo-600 px-4 py-1.5 text-[11px] sm:text-xs text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[32px]">✓ Эрх нээх</button>
                        <button onClick={() => decidePayment(p.id, "reject")} className="rounded-full border border-rose-200 px-4 py-1.5 text-[11px] sm:text-xs text-rose-600 dark:border-rose-400/30 dark:text-rose-400 min-h-[32px]">Татгалзах</button>
                      </div>
                    )}
                  </div>
                ))}
                {payments.length === 0 && <p className="text-sm text-zinc-500 text-center py-6">Хүсэлт алга</p>}
              </div>
            </div>
          )}
        </main>
      </div>
      {editReport && (
        <QuestionEditor
          report={editReport}
          onClose={() => setEditReport(null)}
          onSaved={(questionId, newText, resolved) => {
            setReportQ((prev) => ({ ...prev, [questionId]: newText }));
            if (resolved) fetchReports(reportFilter, reports.length === 1 && reportsPage > 1 ? reportsPage - 1 : reportsPage);
          }}
        />
      )}
    </div>
  );
}
