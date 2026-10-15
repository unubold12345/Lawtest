// Saved (paused) exams — one per category key. Local always; DB when authed.
export type SavedExam = {
  key: string;
  tag: string | null;
  mode: "exam" | "study";
  minutes: number;
  ids: string[];
  answers: Record<string, number>;
  optionOrder: Record<string, number[]>;
  idx: number;
  timeLeft: number;
  elapsed: number;
  updatedAt: number;
};

const LEGACY_KEY = "lawtest_saved_exams";
export const SAVED_EXAMS_KEY = LEGACY_KEY;

// per-account namespace: saved exams must not leak between users on a shared browser
export function savedExamsKey(owner?: string | null) {
  return `${SAVED_EXAMS_KEY}:${owner || "guest"}`;
}

function readMap(key: string): Record<string, SavedExam> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, SavedExam>;
  } catch {
    return {};
  }
}

function writeMap(key: string, all: Record<string, SavedExam>) {
  try {
    localStorage.setItem(key, JSON.stringify(all));
  } catch {}
}

export function readLocalSavedExams(owner?: string | null): Record<string, SavedExam> {
  if (typeof window === "undefined") return {};
  const key = savedExamsKey(owner);
  const own = readMap(key);
  // records from before per-account storage live under the bare key; first signed-in reader claims them once
  if (owner && Object.keys(own).length === 0) {
    const legacy = readMap(LEGACY_KEY);
    if (Object.keys(legacy).length > 0) {
      writeMap(key, legacy);
      try {
        localStorage.removeItem(LEGACY_KEY);
      } catch {}
      return legacy;
    }
  }
  return own;
}

export function writeLocalSavedExam(rec: SavedExam, owner?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = savedExamsKey(owner);
    const all = readLocalSavedExams(owner);
    all[rec.key] = rec;
    writeMap(key, all);
    window.dispatchEvent(new Event("lawtest:saved-exams"));
  } catch {}
}

export function removeLocalSavedExam(examKey: string, owner?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = savedExamsKey(owner);
    const all = readLocalSavedExams(owner);
    delete all[examKey];
    writeMap(key, all);
    window.dispatchEvent(new Event("lawtest:saved-exams"));
  } catch {}
}

// Per-account local attempts + offline pending-sync queue
export type LocalAttempt = {
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
  pendingSync?: boolean;
};

const LEGACY_ATTEMPTS_KEY = "lawtest_attempts";

export function attemptsKey(owner?: string | null) {
  return `${LEGACY_ATTEMPTS_KEY}:${owner || "guest"}`;
}

export function readLocalAttempts(owner?: string | null): LocalAttempt[] {
  if (typeof window === "undefined") return [];
  const key = attemptsKey(owner);
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    const legacyRaw = localStorage.getItem(LEGACY_ATTEMPTS_KEY);
    const legacy = legacyRaw ? JSON.parse(legacyRaw) : null;
    if (Array.isArray(legacy) && legacy.length > 0) {
      localStorage.setItem(key, JSON.stringify(legacy));
      localStorage.removeItem(LEGACY_ATTEMPTS_KEY);
      return legacy;
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalAttempt(attempt: LocalAttempt, owner?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const arr = readLocalAttempts(owner);
    arr.unshift(attempt);
    localStorage.setItem(attemptsKey(owner), JSON.stringify(arr.slice(0, 50)));
  } catch {}
}

export function removeLocalAttempt(id: string, owner?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const arr = readLocalAttempts(owner).filter((a) => a.id !== id);
    localStorage.setItem(attemptsKey(owner), JSON.stringify(arr));
  } catch {}
}

export function clearLocalAttempts(owner?: string | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(attemptsKey(owner));
  } catch {}
}

export async function syncPendingAttempts(owner?: string | null): Promise<void> {
  if (typeof window === "undefined" || !owner) return;
  const all = readLocalAttempts(owner);
  const pending = all.filter((a) => a && a.pendingSync);
  if (pending.length === 0) return;
  const syncedIds = new Set<string>();
  for (const item of [...pending].reverse()) {
    try {
      const r = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: item.category,
          mode: item.mode,
          score: item.score,
          total: item.total,
          elapsed: item.elapsed,
          answers: item.answers || {},
          questionIds: item.questionIds || [],
        }),
      });
      if (r.ok) syncedIds.add(item.id);
    } catch {
      break;
    }
  }
  if (syncedIds.size > 0) {
    try {
      const remaining = readLocalAttempts(owner).filter((a) => !syncedIds.has(a.id));
      localStorage.setItem(attemptsKey(owner), JSON.stringify(remaining));
    } catch {}
  }
}
