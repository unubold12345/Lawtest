import { NextResponse } from "next/server";
import { requestUserId } from "@/lib/mobileAuth";
import { prisma } from "@/lib/prisma";

// Daily to-do items for the Сорилго төв hub (v2), synced across devices.
// GET    -> { todos: [{ id, text, main, sub, done, date }, ...] } (newest first)
// POST   { id, text, main, sub, date } -> create one item
// PATCH  { id, done?, text? } -> update own item
// DELETE ?id=... -> remove own item; ?doneDate=YYYY-MM-DD -> clear completed items of that day
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clampStr(v: unknown, max: number) {
  return String(v ?? "").trim().slice(0, max);
}

async function getUserId(req: Request) {
  return requestUserId(req);
}

export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const rows = await prisma.studyTodo.findMany({
    where: { userId },
    select: { id: true, text: true, main: true, sub: true, done: true, date: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ todos: rows });
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  let body: { id?: unknown; text?: unknown; main?: unknown; sub?: unknown; date?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  const id = clampStr(body.id, 64);
  const text = clampStr(body.text, 300);
  const main = clampStr(body.main, 100) || "all";
  const sub = clampStr(body.sub, 100) || "all";
  const date = clampStr(body.date, 10);
  if (!id || (!text && main === "all" && sub === "all") || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  try {
    await prisma.studyTodo.create({ data: { id, userId, text, main, sub, date } });
  } catch {
    // idempotent: migration retries / StrictMode double-run can POST the same id twice
    const existing = await prisma.studyTodo.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Хадгалж чадсангүй" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  let body: { id?: unknown; done?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  const id = clampStr(body.id, 64);
  if (!id) return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  const data: { done?: boolean; text?: string } = {};
  if (typeof body.done === "boolean") data.done = body.done;
  if (typeof body.text === "string") data.text = clampStr(body.text, 300);
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  const r = await prisma.studyTodo.updateMany({ where: { id, userId }, data });
  return NextResponse.json({ ok: true, updated: r.count });
}

export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const url = new URL(req.url);
  const id = clampStr(url.searchParams.get("id"), 64);
  const doneDate = clampStr(url.searchParams.get("doneDate"), 10);
  if (id) {
    const r = await prisma.studyTodo.deleteMany({ where: { id, userId } });
    return NextResponse.json({ ok: true, deleted: r.count });
  }
  if (doneDate && DATE_RE.test(doneDate)) {
    const r = await prisma.studyTodo.deleteMany({ where: { userId, date: doneDate, done: true } });
    return NextResponse.json({ ok: true, deleted: r.count });
  }
  return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
}
