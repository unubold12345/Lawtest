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

export const SAVED_EXAMS_KEY = "lawtest_saved_exams";

export function readLocalSavedExams(): Record<string, SavedExam> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SAVED_EXAMS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, SavedExam>;
  } catch {
    return {};
  }
}

export function writeLocalSavedExam(rec: SavedExam) {
  if (typeof window === "undefined") return;
  try {
    const all = readLocalSavedExams();
    all[rec.key] = rec;
    localStorage.setItem(SAVED_EXAMS_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event("lawtest:saved-exams"));
  } catch {}
}

export function removeLocalSavedExam(key: string) {
  if (typeof window === "undefined") return;
  try {
    const all = readLocalSavedExams();
    delete all[key];
    localStorage.setItem(SAVED_EXAMS_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event("lawtest:saved-exams"));
  } catch {}
}
