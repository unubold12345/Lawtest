import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { passwordProblem } from "@/lib/password";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  if (!rateLimit(`pwchange:${userId}`, 6, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу." }, { status: 429 });
  }
  let body: { current?: unknown; next?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  const current = String(body?.current ?? "");
  const next = String(body?.next ?? "");
  const problem = passwordProblem(next);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!user?.password) {
    return NextResponse.json({ error: "Нууц үг тохируулагдаагүй байна. Нэвтрэх хуудсаас «Нууц үг сэргээх»-ийг ашиглана уу." }, { status: 400 });
  }
  if (!(await bcrypt.compare(current, user.password))) {
    return NextResponse.json({ error: "Одоогийн нууц үг буруу" }, { status: 400 });
  }
  const hashed = await bcrypt.hash(next, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed, passwordChangedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
