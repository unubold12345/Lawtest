import { NextResponse } from "next/server";
import { loadQuestions } from "@/lib/questions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const data = loadQuestions();
  const url = new URL(req.url);
  if (url.searchParams.get("full") === "1") {
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
