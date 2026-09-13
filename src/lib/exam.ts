// Exam banner config — single place to roll dates each year so the
// homepage never shows a stale exam date after the exam has passed.
export const EXAM = {
  label: "Хуульчийн шалгалт · 2026",
  dates: "10-р сарын 28, 29, 30",
  regOpenText: "Бүртгэл 9-р сарын 27-нд хаагдана",
  regClosedText: "Бүртгэл хаагдсан",
  signupUrl: "https://burtgel.mglbar.mn/",
  signupLabel: "burtgel.mglbar.mn",
  // Mongolia time (UTC+8)
  regClose: new Date("2026-09-27T23:59:59+08:00"),
  examEnd: new Date("2026-10-30T23:59:59+08:00"),
};

export type ExamPhase = "open" | "reg-closed" | "done";

export function examPhase(now: Date = new Date()): ExamPhase {
  if (now > EXAM.examEnd) return "done";
  if (now > EXAM.regClose) return "reg-closed";
  return "open";
}
