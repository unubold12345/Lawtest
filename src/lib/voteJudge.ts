// Community judging for questions with no file answer.
// Priority: file answer (locked) → user's own saved option → majority vote → auto-correct.
export type JudgeSource = "file" | "personal" | "majority" | "auto" | "unknown";

export interface JudgeResult {
  correct: number | null;
  source: JudgeSource;
}

interface JudgeQuestion {
  id: string;
  answer?: number | number[] | null;
  options: unknown[];
}

interface JudgeCtx {
  overrides?: Record<string, number>; // this device (localStorage)
  my?: Record<string, number>; // this user (server SavedAnswer)
  counts?: Record<string, number[]>; // community per-option tallies
}

export function fileAnswer(q: JudgeQuestion): number | null {
  const a = q.answer;
  if (typeof a === "number") return a;
  if (Array.isArray(a) && a.length > 0 && typeof a[0] === "number") return a[0] as number;
  return null;
}

// most-voted original option index; null when no votes or a tie for first
export function majorityOf(counts: number[] | undefined, nOptions: number): number | null {
  if (!counts) return null;
  let top = -1;
  let topV = 0;
  let topN = 0;
  let total = 0;
  for (let i = 0; i < nOptions; i++) {
    const v = counts[i] || 0;
    total += v;
    if (v > topV) {
      topV = v;
      top = i;
      topN = 1;
    } else if (v === topV) {
      topN++;
    }
  }
  if (total === 0 || topV === 0 || topN > 1) return null;
  return top;
}

function validIndex(v: unknown, n: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < n;
}

export function judgeQuestion(q: JudgeQuestion, ctx: JudgeCtx): JudgeResult {
  const f = fileAnswer(q);
  if (f !== null) return { correct: f, source: "file" };
  const n = Array.isArray(q.options) ? q.options.length : 0;
  if (validIndex(ctx.overrides?.[q.id], n)) return { correct: ctx.overrides![q.id], source: "personal" };
  if (validIndex(ctx.my?.[q.id], n)) return { correct: ctx.my![q.id], source: "personal" };
  const c = ctx.counts?.[q.id];
  if (c === undefined) return { correct: null, source: "unknown" }; // votes not loaded yet
  const maj = majorityOf(c, n);
  if (maj === null) return { correct: null, source: "auto" }; // nobody saved or tie
  return { correct: maj, source: "majority" };
}
