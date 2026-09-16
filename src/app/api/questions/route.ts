import { NextResponse } from "next/server";
import { loadQuestions } from "@/lib/questions";
import { buildIndex } from "@/lib/questionIndexServer";

export const dynamic = "force-dynamic";

// Modes:
//   ?index=1              -> light index (ids + cat/sub refs + hasAnswer)
//   ?filter=1&q=&by=      -> ids matching a text query (by=all|qo)
//   ?ids=a,b,c            -> full questions for those ids
//   ?ids=a,b,c&texts=1    -> { id, question } only (light)
//   ?meta=1               -> totals + per main/sub category counts
//   ?full=1               -> everything (legacy)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const data = loadQuestions();

  if (sp.get("index") === "1") {
    return NextResponse.json(buildIndex());
  }

  if (sp.get("filter") === "1") {
    const q = (sp.get("q") || "").trim().toLowerCase();
    if (!q) return NextResponse.json({ ids: [] });
    const byOptionsOnly = sp.get("by") === "qo";
    const ids = data.questions
      .filter(
        (x) =>
          x.question.toLowerCase().includes(q) ||
          x.options.some((o) => o.toLowerCase().includes(q)) ||
          (!byOptionsOnly && (x.category?.toLowerCase().includes(q) || x.subCategory?.toLowerCase().includes(q)))
      )
      .map((x) => x.id);
    return NextResponse.json({ ids });
  }

  const idsParam = sp.get("ids");
  if (idsParam) {
    const wanted = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const set = new Set(wanted);
    const found = data.questions.filter((q) => set.has(q.id));
    if (sp.get("texts") === "1") {
      return NextResponse.json({ questions: found.map((q) => ({ id: q.id, question: q.question })) });
    }
    return NextResponse.json({ total: found.length, questions: found });
  }

  if (sp.get("meta") === "1") {
    const mains = new Map<string, { total: number; subs: Map<string, number> }>();
    for (const q of data.questions) {
      const main = q.category || "Бусад";
      const sub = q.subCategory || "Ерөнхий";
      if (!mains.has(main)) mains.set(main, { total: 0, subs: new Map() });
      const g = mains.get(main)!;
      g.total += 1;
      g.subs.set(sub, (g.subs.get(sub) || 0) + 1);
    }
    return NextResponse.json({
      total: data.questions.length,
      mains: [...mains.entries()].map(([name, g]) => ({
        name,
        total: g.total,
        subs: [...g.subs.entries()].map(([subName, count]) => ({ name: subName, count })),
      })),
    });
  }

  if (sp.get("full") === "1") {
    return NextResponse.json({
      total: data.questions.length,
      sources: data.sources,
      errors: data.errors,
      questions: data.questions,
    });
  }
  return NextResponse.json({
    total: data.questions.length,
    sources: data.sources,
    errors: data.errors,
  });
}
