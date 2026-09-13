// Exam banner config — single place to roll dates each year so the
// homepage never shows a stale exam date after the exam has passed.
export const EXAM = {
  label: "Хуульчийн мэргэжлийн шалгалт · 2026",
  dates: "10-р сарын 28, 29, 30",
  regOpenText: "Бүртгэл 9-р сарын 27-нд хаагдана",
  regClosedText: "Бүртгэл хаагдсан",
  signupUrl: "https://burtgel.mglbar.mn/",
  signupLabel: "burtgel.mglbar.mn",
  // Mongolia time (UTC+8)
  regClose: new Date("2026-09-27T23:59:59+08:00"),
  examStartKey: "2026-10-28",
  examDayKeys: ["2026-10-28", "2026-10-29", "2026-10-30"],
  examStartMonth: { y: 2026, m: 9 }, // 0-indexed October
  examEnd: new Date("2026-10-30T23:59:59+08:00"),
};

export type ExamPhase = "open" | "reg-closed" | "done";

export function examPhase(now: Date = new Date()): ExamPhase {
  if (now > EXAM.examEnd) return "done";
  if (now > EXAM.regClose) return "reg-closed";
  return "open";
}

// Whole days from today (Mongolia time) until the first exam day.
// Positive = upcoming, 0 = starts today, negative = underway.
export function daysUntilExam(now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const t = Date.parse(fmt.format(now) + "T00:00:00Z");
  const s = Date.parse(EXAM.examStartKey + "T00:00:00Z");
  return Math.round((s - t) / 86400000);
}
