// Pure types + helpers shared by server (index builder) and clients (browse/quiz).
// Keep this file free of server-only imports: it ships to the browser.

export type IndexSub = { name: string; count: number };
export type IndexMain = { name: string; count: number; subs: IndexSub[] };
// tuple form keeps the payload small: [id, mainIdx, subIdx, hasAnswer, isCase]
export type IndexRow = [string, number, number, number, number];
export type IndexData = { total: number; mains: IndexMain[]; allSubs: IndexSub[]; rows: IndexRow[] };

export function indexMainName(index: IndexData, row: IndexRow): string {
  return row[1] >= 0 ? index.mains[row[1]].name : "";
}

export function indexSubName(index: IndexData, row: IndexRow): string {
  if (row[1] < 0 || row[2] < 0) return "";
  return index.mains[row[1]].subs[row[2]].name;
}

export function indexMainId(index: IndexData, name: string): number {
  return index.mains.findIndex((m) => m.name === name);
}
