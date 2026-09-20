import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { clearQuestionsCache, loadQuestions } from "@/lib/questions";
import { refreshOverrides } from "@/lib/questionOverrides";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data");

type EditBody = {
  id?: unknown;
  question?: unknown;
  options?: unknown;
  answer?: unknown;
  explanation?: unknown;
  lawRef?: unknown;
};

// PATCH /api/admin/questions — saves the edit to the DB (authoritative; visible to every user
// within a couple of seconds, no deploy needed) and, when the FS is writable, also rewrites the
// question in its data/*.json file. Read-only FS (Vercel) is fine: the file write is best-effort.
export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: EditBody;
  try {
    body = (await req.json()) as EditBody;
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const options = Array.isArray(body.options) ? body.options.map((o) => (typeof o === "string" ? o.trim() : "")) : [];
  const explanation = typeof body.explanation === "string" ? body.explanation.trim() : undefined;
  const lawRef = typeof body.lawRef === "string" ? body.lawRef.trim() : undefined;

  let answer: number | null = null;
  if (body.answer !== null && body.answer !== undefined) {
    if (typeof body.answer !== "number" || !Number.isInteger(body.answer)) {
      return NextResponse.json({ error: "Хариултын формат буруу" }, { status: 400 });
    }
    answer = body.answer;
  }

  if (!id) return NextResponse.json({ error: "Сорилгын id дутуу" }, { status: 400 });
  if (!question) return NextResponse.json({ error: "Асуултын текст хоосон байна" }, { status: 400 });
  if (options.length < 2 || options.length > 6) return NextResponse.json({ error: "2–6 сонголттой байх ёстой" }, { status: 400 });
  if (options.some((o) => !o)) return NextResponse.json({ error: "Сонголтын текст хоосон байна" }, { status: 400 });
  if (answer !== null && (answer < 0 || answer >= options.length)) {
    return NextResponse.json({ error: "Зөв хариултын дугаар буруу" }, { status: 400 });
  }

  const found = loadQuestions().questions.find((q) => q.id === id);
  if (!found) return NextResponse.json({ error: "Сорилго олдсонгүй" }, { status: 404 });
  if (!found.source || found.sourceIndex === undefined || !found.source.toLowerCase().endsWith(".json")) {
    return NextResponse.json({ error: "Зөвхөн JSON файлаас ачаалагдсан сорилгыг засах боломжтой" }, { status: 400 });
  }

  const full = path.join(DATA_DIR, found.source);
  let arr: unknown[];
  let trailingNewline = false;
  let usesCRLF = false;
  try {
    const raw = fs.readFileSync(full, "utf-8").replace(/^\uFEFF/, "");
    trailingNewline = raw.endsWith("\n");
    usesCRLF = raw.includes("\r\n");
    const parsed = JSON.parse(raw);
    arr = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "Файлыг уншиж чадсангүй" }, { status: 500 });
  }

  const target = arr[found.sourceIndex] as Record<string, unknown> | undefined;
  if (!target || typeof target !== "object") {
    return NextResponse.json({ error: "Файл доторх байрлал таарахгүй байна — хуудсаа дахин ачаална уу" }, { status: 409 });
  }
  if (Array.isArray(target.answer)) {
    return NextResponse.json({ error: "Олон зөв хариулттай сорилгыг энэ хэлбэрээр засах боломжгүй" }, { status: 400 });
  }

  const updatedById = (gate.session.user as unknown as { id: string }).id;
  const snapshot = { question, options, answer, explanation: explanation || null, lawRef: lawRef || null };
  try {
    await prisma.questionOverride.upsert({
      where: { questionId: id },
      create: { questionId: id, ...snapshot, updatedById },
      update: { ...snapshot, updatedById },
    });
  } catch {
    return NextResponse.json({ error: "Серверт хадгалж чадсангүй" }, { status: 500 });
  }

  let fileUpdated = false;
  try {
    target.question = question;
    target.options = options;
    if (answer === null) delete target.answer;
    else target.answer = answer;
    if (explanation !== undefined) {
      if (explanation) target.explanation = explanation;
      else delete target.explanation;
    }
    if (lawRef !== undefined) {
      if (lawRef) target.lawRef = lawRef;
      else delete target.lawRef;
    }
    let out = JSON.stringify(arr, null, 2) + (trailingNewline ? "\n" : "");
    if (usesCRLF) out = out.replace(/\n/g, "\r\n");
    fs.writeFileSync(full, out, "utf8");
    fileUpdated = true;
  } catch {
    // read-only FS (production) — the DB row is the source of truth
  }

  clearQuestionsCache();
  await refreshOverrides(true);

  return NextResponse.json({
    ok: true,
    id,
    source: found.source,
    index: found.sourceIndex,
    persisted: fileUpdated ? "db+file" : "db",
  });
}
