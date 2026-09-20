import { prisma } from "@/lib/prisma";
import type { Question } from "@/types/question";

type OverrideRow = {
  questionId: string;
  question: string | null;
  options: unknown;
  answer: number | null;
  explanation: string | null;
  lawRef: string | null;
  updatedAt: Date;
};

const TTL_MS = 2000;

let map = new Map<string, OverrideRow>();
let stamp = "0:0";
let lastChecked = 0;
let inflight: Promise<void> | null = null;

// Reloads the override table at most once per TTL_MS (or force=true right after an edit).
// On failure the previous map is kept, so a DB blip can never blank out question texts.
export async function refreshOverrides(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastChecked < TTL_MS) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const rows = await prisma.questionOverride.findMany();
      const next = new Map<string, OverrideRow>();
      let max = 0;
      for (const r of rows) {
        next.set(r.questionId, r as unknown as OverrideRow);
        const t = new Date(r.updatedAt).getTime();
        if (t > max) max = t;
      }
      map = next;
      stamp = `${rows.length}:${max}`;
    } catch {
      // keep previous overrides
    } finally {
      lastChecked = Date.now();
      inflight = null;
    }
  })();
  return inflight;
}

export function overridesStamp(): string {
  return stamp;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

// Merges DB overrides over file data. Returns the same array when there is nothing to merge.
export function applyOverrides(questions: Question[]): Question[] {
  if (map.size === 0) return questions;
  return questions.map((q) => {
    const o = map.get(q.id);
    if (!o) return q;
    return {
      ...q,
      question: o.question ?? q.question,
      options: isStringArray(o.options) ? o.options : q.options,
      answer: o.answer ?? null,
      explanation: o.explanation ?? undefined,
      lawRef: o.lawRef ?? undefined,
    };
  });
}
