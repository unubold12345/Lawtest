// Official (file/admin) answer helper — the locked source of truth.
export interface JudgeQuestion {
  id: string;
  answer?: number | number[] | null;
  options: unknown[];
}

export function fileAnswer(q: JudgeQuestion): number | null {
  const a = q.answer;
  if (typeof a === "number") return a;
  if (Array.isArray(a) && a.length > 0 && typeof a[0] === "number") return a[0] as number;
  return null;
}
