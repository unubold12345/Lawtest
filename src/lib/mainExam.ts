import { indexSubName, type IndexData, type IndexRow } from "@/lib/questionIndex";

// Main exam blueprint (200 questions), weighted by subcategory:
// - 60% (120): six core acts — 8 from the answered pool + 12 from the
//   admin-answered unanswered pool each.
// - 10% (20): three legal-profession acts — 8 answered + 12 unanswered,
//   apportioned across the three by available size.
// - 30% (60): 2 from III. Жишиг сорилго (admin-answered) + 58 spread
//   proportionally over every other subcategory in both pools.
// Picks inside each group are random; the final set is shuffled.
export const MAIN_EXAM_TOTAL = 200;

const MAIN_EXAM_FOCUS = [
  "Иргэний хууль",
  "Иргэний хэрэг шүүхэд хянан шийдвэрлэх тухай хууль",
  "Эрүүгийн хууль",
  "Эрүүгийн хэрэг хянан шийдвэрлэх тухай хууль",
  "Захиргааны ерөнхий хууль",
  "Захиргааны хэрэг шүүхэд хянан шийдвэрлэх тухай хууль",
];
const MAIN_EXAM_TEN = [
  "Хууль зүйн туслалцааны тухай хууль",
  "Хуульчийн ёс зүй",
  "Хуульчийн эрх зүйн байдлын тухай хууль",
];
const MAIN_EXAM_FOCUS_ANSWERED = 8;
const MAIN_EXAM_FOCUS_UNANSWERED = 12;
const MAIN_EXAM_TEN_ANSWERED = 8;
const MAIN_EXAM_TEN_UNANSWERED = 12;
const MAIN_EXAM_SAMPLE = 2;

const normSubName = (name: string) => name.replace(/^\d+\.\d+[A-Za-zА-Яа-я]?\s+/, "").trim();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function apportion(sizes: Map<string, number>, slots: number): Map<string, number> {
  const out = new Map<string, number>();
  const total = [...sizes.values()].reduce((a, b) => a + b, 0);
  if (total <= 0 || slots <= 0) {
    sizes.forEach((_, k) => out.set(k, 0));
    return out;
  }
  const raw = new Map<string, number>();
  sizes.forEach((n, k) => {
    const v = (slots * n) / total;
    raw.set(k, v);
    out.set(k, Math.floor(v));
  });
  let assigned = [...out.values()].reduce((a, b) => a + b, 0);
  const byFrac = [...sizes.keys()].sort((a, b) => (raw.get(b)! - out.get(b)!) - (raw.get(a)! - out.get(a)!));
  for (const k of byFrac) {
    if (assigned >= slots) break;
    out.set(k, out.get(k)! + 1);
    assigned++;
  }
  return out;
}

function pickStratified(pool: IndexRow[], need: number): IndexRow[] {
  const groups = new Map<string, IndexRow[]>();
  for (const r of pool) {
    const k = `${r[1]}:${r[2]}`;
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const keys = [...groups.keys()];
  if (keys.length === 0 || need <= 0) return [];
  const sizes = new Map(keys.map((k) => [k, groups.get(k)!.length] as [string, number]));
  const take = new Map<string, number>();
  if (keys.length <= need) {
    keys.forEach((k) => take.set(k, 1));
    apportion(sizes, need - keys.length).forEach((n, k) => take.set(k, take.get(k)! + n));
  } else {
    apportion(sizes, need).forEach((n, k) => take.set(k, n));
  }
  const out: IndexRow[] = [];
  take.forEach((n, k) => {
    const g = groups.get(k)!;
    out.push(...shuffle(g).slice(0, Math.min(n, g.length)));
  });
  return out;
}

export function pickMainExamRows(rows: IndexRow[], index: IndexData): IndexRow[] {
  const nameOf = (r: IndexRow) => normSubName(indexSubName(index, r));
  const sampleMain = index.mains.findIndex((m) => m.name.startsWith("III."));
  const isSample = (r: IndexRow) => r[1] === sampleMain;
  const named = new Set([...MAIN_EXAM_FOCUS, ...MAIN_EXAM_TEN]);

  // loadQuestions() merges overrides, so admin-answered questions carry a
  // file-level answer bit too: the pure file pool is hasAnswer && !adminAdded,
  // the unanswered-bank pool is adminAdded.
  const fileRows = rows.filter((r) => r[3] === 1 && r[5] === 0);
  const adminRows = rows.filter((r) => r[5] === 1);
  const out: IndexRow[] = [];
  const takeFrom = (pool: IndexRow[], need: number) => {
    if (need > 0) out.push(...shuffle(pool).slice(0, need));
  };

  for (const name of MAIN_EXAM_FOCUS) {
    takeFrom(fileRows.filter((r) => !isSample(r) && nameOf(r) === name), MAIN_EXAM_FOCUS_ANSWERED);
    takeFrom(adminRows.filter((r) => !isSample(r) && nameOf(r) === name), MAIN_EXAM_FOCUS_UNANSWERED);
  }

  const tenAnswered = new Map<string, number>();
  const tenUnanswered = new Map<string, number>();
  for (const name of MAIN_EXAM_TEN) {
    tenAnswered.set(name, fileRows.filter((r) => !isSample(r) && nameOf(r) === name).length);
    tenUnanswered.set(name, adminRows.filter((r) => !isSample(r) && nameOf(r) === name).length);
  }
  const answeredTake = apportion(tenAnswered, MAIN_EXAM_TEN_ANSWERED);
  const unansweredTake = apportion(tenUnanswered, MAIN_EXAM_TEN_UNANSWERED);
  for (const name of MAIN_EXAM_TEN) {
    takeFrom(fileRows.filter((r) => !isSample(r) && nameOf(r) === name), answeredTake.get(name) ?? 0);
    takeFrom(adminRows.filter((r) => !isSample(r) && nameOf(r) === name), unansweredTake.get(name) ?? 0);
  }

  out.push(...pickStratified(adminRows.filter((r) => isSample(r)), MAIN_EXAM_SAMPLE));

  const restGroups = new Map<string, IndexRow[]>();
  for (const r of [...fileRows, ...adminRows]) {
    if (isSample(r) || named.has(nameOf(r))) continue;
    const k = `${r[1]}\u0001${r[2]}`;
    const g = restGroups.get(k);
    if (g) g.push(r);
    else restGroups.set(k, [r]);
  }
  const restSizes = new Map([...restGroups].map(([k, g]) => [k, g.length] as [string, number]));
  apportion(restSizes, MAIN_EXAM_TOTAL - out.length).forEach((n, k) => {
    const g = restGroups.get(k)!;
    if (n > 0) out.push(...shuffle(g).slice(0, Math.min(n, g.length)));
  });

  return shuffle(out);
}
