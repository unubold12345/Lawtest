import type { Question } from "@/types/question";

// Question ids can be long composite keys (e.g. "1. Нийтийн эрх зүй_1.35 …_q007"),
// so chunks must be sized by URL length, not id count (400 ids ≈ 21KB URL → HTTP 431).

const MAX_ENCODED_CHARS = 6000;

export function chunkIds(ids: string[], maxChars = MAX_ENCODED_CHARS): string[][] {
  const uniq = [...new Set(ids)].filter(Boolean);
  const chunks: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const id of uniq) {
    const add = encodeURIComponent(id).length + 1;
    if (cur.length > 0 && len + add > maxChars) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(id);
    len += add;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks;
}

export async function fetchQuestionsByIds(ids: string[], opts: { texts?: boolean; headers?: HeadersInit } = {}): Promise<Question[]> {
  const out: Question[] = [];
  for (const chunk of chunkIds(ids)) {
    try {
      const qs = opts.texts ? "&texts=1" : "";
      const r = await fetch(`/api/questions?ids=${encodeURIComponent(chunk.join(","))}${qs}`, { headers: opts.headers });
      if (!r.ok) continue;
      const d = await r.json();
      if (Array.isArray(d?.questions)) out.push(...(d.questions as Question[]));
    } catch { /* skip chunk */ }
  }
  return out;
}
