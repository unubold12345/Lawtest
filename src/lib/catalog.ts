// Stable commercial identifiers. Never reuse an edition/plan ID for new content.
export const LEGACY_EDITION_ID = "lawyer-2026";
export const LEGACY_PLAN_ID = "lawyer-2026-full";
export const LAWYER_2026_PATH = "/exams/lawyer/2026";

export type ExamEdition = {
  id: string;
  examSlug: string;
  examTitle: string;
  year: number;
  title: string;
  description: string;
  href: string;
  dataDirectory: string;
  freeCategories: readonly string[];
};

export type ExamPlan = {
  id: string;
  editionId: string;
  title: string;
  price: number;
  currency: "MNT";
};

// Only publish editions with a question bank and a working study workspace.
// Future banks belong in content/exams/<exam>/<edition>, outside legacy data/.
export const EXAM_EDITIONS: readonly ExamEdition[] = [{
  id: LEGACY_EDITION_ID,
  examSlug: "lawyer",
  examTitle: "Хуульчийн мэргэжлийн шалгалт",
  year: 2026,
  title: "Хуульчийн шалгалт · 2026",
  description: "2026 оны асуултын сан, сэдэвчилсэн сорилго, жишиг шалгалт болон ахицын түүх.",
  href: LAWYER_2026_PATH,
  dataDirectory: "data",
  freeCategories: ["1. Нийтийн эрх зүй"],
}];

export const EXAM_PLANS: readonly ExamPlan[] = [{
  id: LEGACY_PLAN_ID,
  editionId: LEGACY_EDITION_ID,
  title: "2026 · Бүтэн эрх",
  price: 39900,
  currency: "MNT",
}];

export function getEdition(id: string) {
  return EXAM_EDITIONS.find((edition) => edition.id === id);
}

export function getPlan(id: string) {
  return EXAM_PLANS.find((plan) => plan.id === id);
}

export function editionPlans(editionId: string) {
  return EXAM_PLANS.filter((plan) => plan.editionId === editionId);
}
