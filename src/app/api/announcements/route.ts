import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Site-wide announcements for the navbar bell (logged-in users only)
export async function GET() {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const [rows, reads] = await Promise.all([
    prisma.announcement.findMany({
      where: { OR: [{ recipients: { none: {} } }, { recipients: { some: { id: userId } } }] },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, body: true, createdAt: true },
    }),
    prisma.announcementRead.findMany({ where: { userId }, select: { announcementId: true } }),
  ]);
  const readSet = new Set(reads.map((r) => r.announcementId));
  const announcements = rows.map((a) => ({ id: a.id, body: a.body, createdAt: a.createdAt, read: readSet.has(a.id) }));
  const unread = announcements.filter((a) => !a.read).length;
  return NextResponse.json({ announcements, unread });
}
