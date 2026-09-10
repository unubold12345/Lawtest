import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminClient from "@/components/AdminClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="mx-auto max-w-md mt-10 mx-4 sm:mx-auto rounded-2xl border bg-white p-6 sm:p-8 dark:bg-zinc-900 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">Админ — нэвтрэх шаардлагатай</h1>
        <p className="mt-2 text-sm text-zinc-500">Энэ хуудас зөвхөн ADMIN эрхтэй хэрэглэгчид нээлттэй.</p>
        <Link href="/login" className="mt-4 inline-flex rounded-full bg-zinc-900 px-5 py-2.5 text-sm text-white dark:bg-white dark:text-zinc-900">Нэвтрэх</Link>
      </div>
    );
  }
  const userId = (session.user as unknown as { id: string }).id;
  let role: string | null = (session.user as unknown as { role?: string }).role || null;
  try {
    const db = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, phone: true } });
    if (db) role = db.role;
  } catch {}
  if (role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-md mt-10 mx-4 sm:mx-auto rounded-2xl border bg-white p-6 sm:p-8 dark:bg-zinc-900 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">Хандах эрхгүй (403)</h1>
        <p className="mt-2 text-sm text-zinc-500">Таны эрх: <b>{role || "USER"}</b>. Админ болгох заавар доор.</p>
        <div className="mt-4 rounded-xl bg-zinc-50 border p-3 text-xs font-mono break-all dark:bg-zinc-800 dark:border-zinc-700">
          <p className="font-sans font-semibold text-xs mb-1">Админ болгох (нэг удаа):</p>
          npx tsx scripts/promote-admin.ts +97699112233<br />
          эсвэл<br />
          DATABASE_URL=... node -e &quot;require(&apos;./scripts/promote&apos;)&quot;
        </div>
        <div className="mt-4 flex gap-2">
          <Link href="/" className="rounded-full border px-5 py-2.5 text-sm dark:border-zinc-700">Нүүр</Link>
          <Link href="/login" className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm text-white dark:bg-white dark:text-zinc-900">Нэвтрэх</Link>
        </div>
      </div>
    );
  }
  return <AdminClient />;
}
