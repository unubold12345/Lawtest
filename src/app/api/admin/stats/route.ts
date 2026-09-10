import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { loadQuestions } from "@/lib/questions";

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { questions, sources } = loadQuestions();
  const byMain = new Map<string, number>();
  for (const q of questions) {
    const cat = q.category || "Бусад";
    byMain.set(cat, (byMain.get(cat) || 0) + 1);
  }

  const [users, attempts, comments, saved, otps] = await Promise.all([
    prisma.user.count(),
    prisma.attempt.count(),
    prisma.comment.count(),
    prisma.savedAnswer.count(),
    prisma.otp.count(),
  ]);

  const recentUsers = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, phone: true, email: true, role: true, createdAt: true } });
  const recentAttempts = await prisma.attempt.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { user: { select: { phone: true, email: true } } } });

  return NextResponse.json({
    questions: { total: questions.length, byMain: Object.fromEntries(byMain), sources },
    users,
    attempts,
    comments,
    saved,
    otps,
    recentUsers,
    recentAttempts,
  });
}
