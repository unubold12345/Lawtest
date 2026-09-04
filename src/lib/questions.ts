import fs from "node:fs";
import path from "node:path";
import type { Question, QuestionsLoadResult } from "@/types/question";

const DATA_DIR = path.join(process.cwd(), "data");

function parseTxtBlocks(raw: string, file: string): Question[] {
  const blocks = raw
    .split(/\n---\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out: Question[] = [];
  blocks.forEach((block, idx) => {
    const lines = block.split("\n").map((l) => l.trim());
    const qLine = lines.find((l) => l.startsWith("Q:"))?.slice(2).trim();
    const optionLines = lines.filter((l) => /^[A-E]\)/.test(l));
    const answerLine = lines.find((l) => l.startsWith("ANSWER:"))?.slice(7).trim();
    const explanation = lines.find((l) => l.startsWith("EXPLANATION:"))?.slice(12).trim();
    const category = lines.find((l) => l.startsWith("CATEGORY:"))?.slice(9).trim();
    if (!qLine || optionLines.length < 2 || !answerLine) return;
    const options = optionLines.map((l) => l.replace(/^[A-E]\)\s*/, ""));
    // ANSWER: B or ANSWER: 1 (0-based or letter)
    let answer: number | number[] = 0;
    if (/^[A-E]$/i.test(answerLine)) {
      answer = answerLine.toUpperCase().charCodeAt(0) - 65;
    } else if (!isNaN(Number(answerLine))) {
      answer = Number(answerLine);
    }
    out.push({
      id: `${path.basename(file)}_${idx}`,
      category,
      question: qLine,
      options,
      answer,
      explanation,
    });
  });
  return out;
}

function isQuestionArray(v: unknown): v is Question[] {
  return Array.isArray(v) && v.every((x) => x && typeof x.question === "string" && Array.isArray(x.options));
}

export function loadQuestions(): QuestionsLoadResult {
  const result: QuestionsLoadResult = { questions: [], sources: [], errors: [] };
  if (!fs.existsSync(DATA_DIR)) {
    result.errors.push({ file: "data/", message: "data folder not found" });
    return result;
  }
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json") || f.endsWith(".txt"));

  for (const file of files) {
    // Skip example file in production count unless user keeps it
    const full = path.join(DATA_DIR, file);
    try {
      if (file.endsWith(".json")) {
        const raw = fs.readFileSync(full, "utf-8");
        if (!raw.trim() || raw.trim() === "[]") {
          result.sources.push({ file, count: 0 });
          continue;
        }
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        // filter example placeholder if still present
        const filtered = arr.filter((q) => q?.id !== "example_001");
        if (file === "questions.example.json") {
          // don't count example toward totals, just report
          result.sources.push({ file, count: 0 });
          continue;
        }
        if (!isQuestionArray(filtered) && filtered.length > 0) {
          result.errors.push({ file, message: "Invalid JSON shape — expected Question[] (see data/README.md)" });
          continue;
        }
        result.questions.push(...(filtered as Question[]));
        result.sources.push({ file, count: (filtered as Question[]).length });
      } else if (file.endsWith(".txt")) {
        const raw = fs.readFileSync(full, "utf-8");
        const parsed = parseTxtBlocks(raw, file);
        result.questions.push(...parsed);
        result.sources.push({ file, count: parsed.length });
      }
    } catch (e) {
      result.errors.push({ file, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}

// Convenience for server components / API routes
export function getQuestionCount(): number {
  return loadQuestions().questions.length;
}
