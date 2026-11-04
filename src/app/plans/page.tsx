import Link from "next/link";
import { auth } from "@/lib/auth";
import { EXAM_PLANS, getEdition } from "@/lib/catalog";
import { hasEditionAccess } from "@/lib/access";
import { userAccessScope } from "@/lib/entitlements";

export const dynamic = "force-dynamic";
export const metadata = { title: "Төлөвлөгөө, үнэ" };

export default async function PlansPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const access = userId ? await userAccessScope(userId) : {};
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
    <p className="text-xs font-semibold tracking-widest text-indigo-600 dark:text-indigo-300">ТӨЛӨВЛӨГӨӨ, ҮНЭ</p>
    <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Бэлтгэлдээ тохирох эрхээ сонго</h1>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">Эрх бүр зөвхөн сонгосон шалгалт, оны хувилбарт үйлчилнэ. Бусад төрлийн шалгалт болон шинэ оны хувилбар тусдаа төлөвлөгөөтэй.</p>
    <div className="mt-8 grid gap-5 sm:grid-cols-2">
      {EXAM_PLANS.map((plan) => {
        const edition = getEdition(plan.editionId)!;
        const owned = hasEditionAccess(edition.id, access);
        return <article key={plan.id} className="rounded-2xl border border-indigo-200 bg-white p-6 dark:border-indigo-400/25 dark:bg-white/[0.03]">
          <p className="text-sm text-zinc-500">{edition.examTitle}</p><h2 className="mt-2 text-xl font-bold">{plan.title}</h2>
          <p className="mt-5 text-4xl font-extrabold">{plan.price.toLocaleString("mn-MN")}<span className="text-xl">₮</span></p>
          <p className="mt-2 text-xs text-zinc-500">Нэг удаагийн төлбөр · Сонгосон хувилбарт хугацаагүй</p>
          <ul className="mt-6 space-y-3 text-sm"><li>✓ {edition.year} оны бүх ангиллын асуулт</li><li>✓ Сорилго, сургалт, жишиг шалгалт</li><li>✓ Хариулт хадгалах, шалгалт үргэлжлүүлэх</li></ul>
          <Link href={owned ? edition.href : `/plans/${plan.id}`} className="mt-7 flex min-h-12 items-center justify-center rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500">{owned ? "✓ Эрхтэй · Бэлтгэл рүү →" : "Эрх авах →"}</Link>
        </article>;
      })}
    </div>
    <p className="mt-7 rounded-xl bg-zinc-100 p-5 text-sm leading-6 text-zinc-500 dark:bg-white/5">Өмнө авсан Lexlab эрх нь Хуульчийн шалгалтын 2026 хувилбарт хэвээр үйлчилнэ.</p>
  </div>;
}
