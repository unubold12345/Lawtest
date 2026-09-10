import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TYPES = ["WRONG_ANSWER", "WRONG_OPTIONS", "QUESTION_ERROR", "OTHER"] as const;

// User sends an error report about a question -> admin inbox
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  let body: { questionId?: string; type?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  const questionId = (body.questionId || "").trim();
  const type = (body.type || "").trim();
  const message = (body.message || "").trim();
  if (!questionId) return NextResponse.json({ error: "Асуулт сонгогдоогүй" }, { status: 400 });
  if (!(TYPES as readonly string[]).includes(type)) return NextResponse.json({ error: "Төрөл сонгоно уу" }, { status: 400 });
  if (message.length < 3) return NextResponse.json({ error: "Тайлбар бичнэ үү (дор хаяж 3 тэмдэгт)" }, { status: 400 });
  if (message.length > 1000) return NextResponse.json({ error: "Тайлбар хэт урт (≤1000)" }, { status: 400 });
  const r = await prisma.report.create({ data: { questionId, type, message: message.slice(0, 1000), userId } });
  return NextResponse.json({ ok: true, id: r.id });
}
