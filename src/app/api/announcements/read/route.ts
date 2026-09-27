import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Mark announcements as read; no ids = mark all current
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  let body: { ids?: unknown } = {};
  try {
    body = await req.json();
  } catch {}
  let ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 100) : [];
  if (ids.length === 0) {
    const all = await prisma.announcement.findMany({ select: { id: true }, take: 100 });
    ids = all.map((a) => a.id);
  }
  if (ids.length > 0) {
    await prisma.announcementRead.createMany({
      data: ids.map((announcementId) => ({ userId, announcementId })),
      skipDuplicates: true,
    });
  }
  return NextResponse.json({ ok: true });
}
