import { loadQuestions } from "@/lib/questions";
import type { Question } from "@/types/question";
import type { IndexData, IndexMain, IndexRow, IndexSub } from "@/lib/questionIndex";

// Server-only builder for the lightweight question index (see questionIndex.ts).

function hasFileAnswer(q: Question): boolean {
  const a = q.answer;
  return typeof a === "number" || (Array.isArray(a) && a.length > 0);
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

let lastSrc: Question[] | null = null;
let lastIndex: IndexData | null = null;

export function buildIndex(): IndexData {
  const { questions } = loadQuestions();
  if (lastIndex && lastSrc === questions) return lastIndex;

  const mainTotals = new Map<string, number>();
  const mainSubs = new Map<string, Map<string, number>>();
  const allSubCounts = new Map<string, number>();
  for (const q of questions) {
    const cat = q.category || "";
    const sub = q.subCategory || "";
    if (sub) allSubCounts.set(sub, (allSubCounts.get(sub) || 0) + 1);
    if (!cat) continue;
    mainTotals.set(cat, (mainTotals.get(cat) || 0) + 1);
    if (sub) {
      if (!mainSubs.has(cat)) mainSubs.set(cat, new Map());
      const subs = mainSubs.get(cat)!;
      subs.set(sub, (subs.get(sub) || 0) + 1);
    }
  }

  const mains: IndexMain[] = [...mainTotals.entries()]
    .sort((a, b) => collator.compare(a[0], b[0]))
    .map(([name, count]) => ({
      name,
      count,
      subs: [...(mainSubs.get(name)?.entries() ?? [])]
        .map(([sub, n]) => ({ name: sub, count: n }))
        .sort((a, b) => collator.compare(a.name, b.name)),
    }));

  const allSubs: IndexSub[] = [...allSubCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => collator.compare(a.name, b.name));

  const mainIdx = new Map<string, number>();
  const subIdx: Map<string, number>[] = [];
  mains.forEach((m, i) => {
    mainIdx.set(m.name, i);
    subIdx.push(new Map(m.subs.map((s, j) => [s.name, j])));
  });

  const rows: IndexRow[] = questions.map((q) => {
    const cat = q.category || "";
    const m = mainIdx.get(cat) ?? -1;
    const s = m >= 0 && q.subCategory ? (subIdx[m].get(q.subCategory) ?? -1) : -1;
    return [q.id, m, s, hasFileAnswer(q) ? 1 : 0];
  });

  lastSrc = questions;
  lastIndex = { total: questions.length, mains, allSubs, rows };
  return lastIndex;
}
