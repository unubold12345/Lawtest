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
    let answer: number | number[] = 0;
    if (/^[A-E]$/i.test(answerLine)) answer = answerLine.toUpperCase().charCodeAt(0) - 65;
    else if (!isNaN(Number(answerLine))) answer = Number(answerLine);
    out.push({
      id: `${path.parse(file).name}_${idx}`,
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

function walkDataFiles(dir: string, base: string = dir): { full: string; rel: string }[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: { full: string; rel: string }[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full);
    if (e.isDirectory()) out.push(...walkDataFiles(full, base));
    else if (e.isFile() && (e.name.toLowerCase().endsWith(".json") || e.name.toLowerCase().endsWith(".txt")))
      out.push({ full, rel });
  }
  return out;
}

// rel like  "MainCategory/SubCategory.json"  or "FlatCategory.json"  or "questions.json"
// -> main = folder name if has folder else filename without ext (except questions.json keeps embedded)
// -> sub = filename without ext if has folder else undefined
function categoriesFromRel(rel: string, qEmbedded?: string): { category: string; subCategory?: string } {
  const parts = rel.split(path.sep);
  const file = parts[parts.length - 1];
  const fileName = path.parse(file).name;
  if (file === "questions.json") return { category: qEmbedded || fileName, subCategory: undefined };
  if (parts.length === 1) return { category: fileName, subCategory: undefined }; // flat compat
  const main = parts[0];
  return { category: main, subCategory: fileName };
}

export function loadQuestions(): QuestionsLoadResult {
  const result: QuestionsLoadResult = { questions: [], sources: [], errors: [] };
  if (!fs.existsSync(DATA_DIR)) {
    result.errors.push({ file: "data/", message: "data folder not found" });
    return result;
  }
  const files = walkDataFiles(DATA_DIR);
  const seenIds = new Set<string>();

  for (const { full, rel } of files) {
    const file = path.basename(full);
    if (file === "questions.example.json") {
      result.sources.push({ file: rel, count: 0 });
      continue;
    }
    try {
      if (full.toLowerCase().endsWith(".json")) {
        const raw = fs.readFileSync(full, "utf-8").replace(/^\uFEFF/, "");
        if (!raw.trim() || raw.trim() === "[]") {
          result.sources.push({ file: rel, count: 0 });
          continue;
        }
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const filtered = arr.filter((q) => q?.id !== "example_001");
        if (!isQuestionArray(filtered) && filtered.length > 0) {
          result.errors.push({ file: rel, message: "Invalid JSON shape — expected Question[] (see data/README.md)" });
          continue;
        }
        const normalized = (filtered as Question[]).map((q, idx) => {
          const { category: fileCat, subCategory: fileSub } = categoriesFromRel(rel, q.category);
          // filename wins; legacy questions.json keeps embedded category
          const isLegacy = rel === "questions.json";
          let id = q.id || `${fileSub ? `${fileCat}_${fileSub}` : fileCat}_${idx + 1}`;
          if (seenIds.has(id)) id = `${fileSub ? `${fileCat}_${fileSub}` : fileCat}_${id}`;
          seenIds.add(id);
          return {
            ...q,
            id,
            category: isLegacy ? q.category || fileCat : fileCat,
            subCategory: isLegacy ? q.subCategory : fileSub ?? q.subCategory,
            source: rel,
          };
        });
        result.questions.push(...normalized);
        result.sources.push({ file: rel, count: normalized.length });
      } else if (full.toLowerCase().endsWith(".txt")) {
        const raw = fs.readFileSync(full, "utf-8").replace(/^\uFEFF/, "");
        const { category: fileCat, subCategory: fileSub } = categoriesFromRel(rel);
        const parsed = parseTxtBlocks(raw, file).map((q) => {
          let id = q.id;
          if (seenIds.has(id)) id = `${fileSub ? `${fileCat}_${fileSub}` : fileCat}_${id}`;
          seenIds.add(id);
          return { ...q, id, category: fileCat, subCategory: fileSub, source: rel };
        });
        result.questions.push(...parsed);
        result.sources.push({ file: rel, count: parsed.length });
      }
    } catch (e) {
      result.errors.push({ file: rel, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}

export function getQuestionCount(): number {
  return loadQuestions().questions.length;
}
