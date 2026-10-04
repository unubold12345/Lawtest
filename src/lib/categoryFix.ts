// Client-safe helpers for the admin "Зассан" (fixed) marks per data file.
// Key = (main category folder, subcategory filename) — same pair the question
// loader derives from data/<Main>/<Sub>.json (see categoriesFromRel in questions.ts).

export const FIX_SEP = "\u0001";

export function fixKey(category: string, subCategory: string): string {
  return `${category}${FIX_SEP}${subCategory}`;
}

// "II. Хоёрдугаар хэсэг/2.9 Хөдөлмөрийн тухай хууль.json" -> { category, subCategory }
// "questions.json" (flat) -> { category: "questions", subCategory: "" }
export function pairFromRel(rel: string): { category: string; subCategory: string } {
  const parts = rel.split(/[\\/]/).filter(Boolean);
  const last = parts[parts.length - 1] ?? rel;
  const noExt = last.replace(/\.(json|txt)$/i, "");
  if (parts.length >= 2) return { category: parts[parts.length - 2], subCategory: noExt };
  return { category: noExt, subCategory: "" };
}
