import { PlanLink } from "@/components/PlansProvider";
import Link from "next/link";
import { EXAM_EDITIONS, editionPlans, LEGACY_EDITION_ID } from "@/lib/catalog";
import { getQuestionCount } from "@/lib/questions";

export default function ExamCatalog() {
  const legacyCount = getQuestionCount();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-indigo-50 p-6 sm:p-12 dark:border-indigo-400/20 dark:bg-indigo-500/[0.08]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">Lexlab · Шалгалтын бэлтгэл</p>
        <h1 className="mt-5 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Шалгалтаа сонго.<br />Бэлтгэлээ эхлүүл.</h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-600 sm:text-base dark:text-zinc-400">Шалгалтын төрөл, оны хувилбараар бэлтгэлээ сонгоорой. Асуултын сан, сорилго, жишиг шалгалт — нэг дор.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="#exam-catalog" className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500">Шалгалтуудыг үзэх ↓</a>
          <PlanLink href="/plans" className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium hover:bg-white/50 dark:border-white/20 dark:hover:bg-white/5">Төлөвлөгөө, үнэ →</PlanLink>
        </div>
      </section>

      <section id="exam-catalog" className="scroll-mt-24 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold tracking-widest text-indigo-600 dark:text-indigo-300">ШАЛГАЛТЫН САН</p><h2 className="mt-2 text-2xl font-bold">Өөрийн шалгалтаа сонгоорой</h2></div>
          <p className="text-sm text-zinc-500">{EXAM_EDITIONS.length} хувилбар нээлттэй</p>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {EXAM_EDITIONS.map((edition) => {
            const plan = editionPlans(edition.id)[0];
            const count = edition.id === LEGACY_EDITION_ID ? legacyCount : null;
            return <article key={edition.id} className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center justify-between"><span className="rounded-lg bg-indigo-50 px-3 py-2 text-xl font-extrabold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{edition.year}</span><span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">● Бэлтгэх боломжтой</span></div>
              <h3 className="mt-6 text-xl font-bold">{edition.examTitle}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{edition.description}</p>
              <p className="mt-5 text-sm font-medium">{count !== null ? `${count.toLocaleString("mn-MN")} асуулт` : "Асуултын сан"}{edition.freeCategories.length > 0 && <><span className="px-2 text-zinc-400">·</span> Үнэгүй турших боломжтой</>}</p>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 pt-5 dark:border-white/10">
                <Link href={edition.href} className="rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500">{edition.year} бэлтгэл рүү →</Link>
                {plan && <PlanLink href={`/plans/${plan.id}`} className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">{plan.price.toLocaleString("mn-MN")}₮ · Бүтэн эрх</PlanLink>}
              </div>
            </article>;
          })}
          <div className="flex flex-col justify-center rounded-2xl border border-dashed border-zinc-300 p-6 sm:p-8 dark:border-white/15">
            <span className="text-3xl text-zinc-400" aria-hidden>＋</span>
            <h3 className="mt-4 text-lg font-semibold">Шинэ шалгалтууд нэмэгдэнэ</h3>
            <p className="mt-3 text-sm leading-7 text-zinc-500">Шинэ төрлийн шалгалт болон дараагийн оны хувилбарууд тусдаа асуултын сан, тусдаа үнэтэй байна. Нээлттэй болмогц эндээс сонгох боломжтой.</p>
          </div>
        </div>
      </section>
      <section className="mt-10 grid gap-6 rounded-2xl bg-zinc-100 p-6 sm:grid-cols-3 dark:bg-white/[0.03]">
        {[
          ["01", "Төрлөө сонго", "Өгөх шалгалт болон оны хувилбараа сонгоно."],
          ["02", "Үнэгүй турш", "Нээлттэй ангиллын асуултаар эхлээд туршаарай."],
          ["03", "Бэлтгэлээ үргэлжлүүл", "Сонгосон хувилбарын эрхээ авч, ахицаа хянаарай."],
        ].map(([n, title, text]) => <div key={n}><p className="text-xs font-bold text-indigo-500">{n}</p><h3 className="mt-2 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p></div>)}
      </section>
    </div>
  );
}
