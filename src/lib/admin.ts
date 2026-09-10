import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string })?.role;
  const userId = (session?.user as unknown as { id?: string })?.id;
  if (!session?.user || !userId) return { ok: false as const, status: 401, error: "Нэвтрэх шаардлагатай" };
  // also verify from DB in case token stale
  try {
    const db = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const effectiveRole = db?.role || role;
    if (effectiveRole !== "ADMIN") return { ok: false as const, status: 403, error: "Админ эрх шаардлагатай" };
  } catch {
    if (role !== "ADMIN") return { ok: false as const, status: 403, error: "Админ эрх шаардлагатай" };
  }
  return { ok: true as const, session };
}

export async function isAdmin() {
  const r = await requireAdmin();
  return r.ok;
}
