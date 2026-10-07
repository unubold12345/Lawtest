// Study v2 (/v2) client-side helpers: local resume record + study-day log.
// Server-side per-question progress lives in the StudyCard table (/api/study).

export type StudyRunType = "smart" | "new" | "missed" | "refresh";

export type StudySession = {
  v: 2;
  main: string; // "all" | main category name
  sub: string; // "all" | subcategory name
  type: StudyRunType;
  immediate: boolean;
  ids: string[];
  order: Record<string, number[]>; // option display order per question
  answers: Record<string, number>;
  idx: number;
  elapsed: number; // seconds spent in the session
  startedAt: number;
  updatedAt: number;
};

const RUN_KEY = "lexlab_study2";
const DAYS_KEY = "lexlab_study2_days";

function key(base: string, owner?: string | null) {
  return `${base}:${owner || "guest"}`;
}

export function readStudySession(owner?: string | null): StudySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(RUN_KEY, owner));
    if (!raw) return null;
    const rec = JSON.parse(raw) as StudySession;
    if (!rec || rec.v !== 2 || !Array.isArray(rec.ids) || rec.ids.length === 0) return null;
    return rec;
  } catch {
    return null;
  }
}

export function writeStudySession(rec: StudySession, owner?: string | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(RUN_KEY, owner), JSON.stringify(rec));
  } catch {}
}

export function clearStudySession(owner?: string | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(RUN_KEY, owner));
  } catch {}
}

// Study-day log (local): "N өдөр дараалан" streak on the dashboard.
export function dayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function bumpStudyDay(owner?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const k = key(DAYS_KEY, owner);
    const raw = localStorage.getItem(k);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const today = dayKey();
    const list = (Array.isArray(parsed) ? (parsed as string[]) : []).filter(
      (d) => typeof d === "string" && d !== today
    );
    list.push(today);
    localStorage.setItem(k, JSON.stringify(list.slice(-400)));
  } catch {}
}

export function studyStreak(owner?: string | null): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(key(DAYS_KEY, owner));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed) || parsed.length === 0) return 0;
    const set = new Set(parsed as string[]);
    const cur = new Date();
    if (!set.has(dayKey(cur))) {
      cur.setDate(cur.getDate() - 1);
      if (!set.has(dayKey(cur))) return 0;
    }
    let n = 0;
    while (set.has(dayKey(cur))) {
      n++;
      cur.setDate(cur.getDate() - 1);
    }
    return n;
  } catch {
    return 0;
  }
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
