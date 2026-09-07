"use client";

const KEY = "lawtest_answer_overrides"; // { [questionId]: number }

type Overrides = Record<string, number>;

function read(): Overrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Overrides) : {};
  } catch {
    return {};
  }
}

export function getOverride(id: string): number | null {
  const m = read();
  const v = m[id];
  return typeof v === "number" ? v : null;
}

export function setOverride(id: string, answerIndex: number | null) {
  const m = read();
  if (answerIndex === null || answerIndex === undefined) {
    delete m[id];
  } else {
    m[id] = answerIndex;
  }
  localStorage.setItem(KEY, JSON.stringify(m));
  // notify same-tab listeners
  window.dispatchEvent(new CustomEvent("lawtest:overrides", { detail: { id, answerIndex } }));
}

export function getAllOverrides(): Overrides {
  return read();
}

export function fileHasAnswer(q: { answer?: number | number[] | null }): boolean {
  const a = q.answer;
  return typeof a === "number" || (Array.isArray(a) && a.length > 0 && typeof a[0] === "number");
}

// resolve effective answer: file answer is locked and cannot be changed.
// Only questions with no file answer use the user-saved override.
export function effectiveAnswer(
  q: { id: string; answer?: number | number[] | null },
  overrides?: Overrides
): number | null {
  const a = q.answer;
  if (typeof a === "number") return a;
  if (Array.isArray(a) && a.length > 0 && typeof a[0] === "number") return a[0] as number;
  const o = overrides ?? read();
  if (typeof o[q.id] === "number") return o[q.id] as number;
  return null;
}
