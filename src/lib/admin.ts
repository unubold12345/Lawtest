import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireAdmin() {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!session?.user || !userId) return { ok: false as const, status: 401, error: "Нэвтрэх шаардлагатай" };
  // authority comes from the current DB row only — a deleted user must not
  // keep admin via a stale token, and DB failures must not grant access
  try {
    const db = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!db || db.role !== "ADMIN") return { ok: false as const, status: 403, error: "Админ эрх шаардлагатай" };
  } catch {
    return { ok: false as const, status: 503, error: "Серверийн алдаа" };
  }
  return { ok: true as const, session };
}

export async function isAdmin() {
  const r = await requireAdmin();
  return r.ok;
}
