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
