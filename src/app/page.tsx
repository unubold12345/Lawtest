import fs from "node:fs";
import path from "node:path";
import { loadQuestions } from "@/lib/questions";
import Link from "next/link";
import HomeCategories from "@/components/HomeCategories";
import HomeContinue from "@/components/HomeContinue";

export default function Home() {
  const { questions } = loadQuestions();
  const total = questions.length;
  const byMain = new Map<string, { total: number; subs: Map<string, number> }>();
  for (const q of questions) {
    const main = q.category || "Бусад";
    const sub = q.subCategory || "Ерөнхий";
    if (!byMain.has(main)) byMain.set(main, { total: 0, subs: new Map() });
    const g = byMain.get(main)!;
    g.total += 1;
    g.subs.set(sub, (g.subs.get(sub) || 0) + 1);
  }
  // show empty main categories (folders with no questions yet)
  try {
    const dataDir = path.join(process.cwd(), "data");
    for (const e of fs.readdirSync(dataDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (!byMain.has(e.name)) byMain.set(e.name, { total: 0, subs: new Map() });
    }
  } catch {}
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const mains = [...byMain.entries()]
    .sort((a, b) => collator.compare(a[0], b[0]))
    .map(([name, { total, subs }]) => ({
      name,
      total,
      subs: [...subs.entries()]
        .sort((a, b) => collator.compare(a[0], b[0]))
        .map(([subName, count]) => ({ name: subName, count })),
    }));
  const mainCount = mains.length;
  const subCount = mains.reduce((a, m) => a + m.subs.length, 0);
  const topMains = [...mains].sort((a, b) => b.total - a.total).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border bg-zinc-950 p-4 sm:p-10 text-white dark:bg-zinc-900 dark:border-zinc-800">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(600px 200px at 15% 0%, rgba(255,255,255,0.14), transparent), radial-gradient(500px 220px at 90% 100%, rgba(255,255,255,0.10), transparent)",
          }}
        />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="rounded-full bg-white/10 border border-white/15 px-2.5 py-1 text-[10px] sm:text-xs font-medium">
              {total} асуулт бэлэн
            </span>
            <span className="rounded-full bg-white/10 border border-white/15 px-2.5 py-1 text-[10px] sm:text-xs">
              {mainCount} үндсэн · {subCount} дэд ангилал
            </span>
            <span className="rounded-full bg-emerald-400/15 border border-emerald-300/20 px-2.5 py-1 text-[10px] sm:text-xs text-emerald-200">
              Үнэ төлбөргүй
            </span>
          </div>

          <h1 className="mt-3 text-[20px] sm:text-4xl font-bold leading-tight tracking-tight">
            Хуулийн шалгалтад
            <br className="sm:hidden" /> итгэлтэй бэлд.
          </h1>
          <p className="mt-1.5 sm:mt-3 max-w-2xl text-[12px] sm:text-base leading-snug sm:leading-relaxed text-zinc-300">
            Ангиллаар шүүж үз, цагтай шалгалт өг, сургалтын горимоор шууд шалга.
            Ахиц чинь түүхэнд хадгалагдана — утаснаасаа ч бэлдэх боломжтой.
          </p>

          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Link
              href="/quiz"
              className="rounded-full bg-white px-5 py-2.5 sm:px-7 sm:py-3 text-[13px] sm:text-sm font-semibold text-zinc-900 text-center min-h-[40px] sm:min-h-[48px] flex items-center justify-center hover:bg-zinc-100"
            >
              Шалгалт эхлэх →
            </Link>
            <Link
              href="/browse"
              className="rounded-full border border-white/25 px-5 py-2.5 sm:px-7 sm:py-3 text-[13px] sm:text-sm font-medium text-white text-center min-h-[40px] sm:min-h-[48px] flex items-center justify-center hover:bg-white/10"
            >
              Бүх асуулт үзэх
            </Link>
          </div>

          <p className="mt-3 text-[10px] sm:text-xs text-zinc-400">
            Бүртгэлгүйгээр шалгалт өгч болно · Утас + нууц үгээр нэвтрэх · iOS / Android-д тохиромжтой
          </p>
        </div>
      </div>

      {/* EXAM INFO */}
      <div className="rounded-xl sm:rounded-2xl border border-amber-300 bg-amber-50 p-3 sm:p-6 dark:bg-amber-950/30 dark:border-amber-800">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-amber-800 dark:text-amber-200">
            Хуульчийн шалгалт 2026
          </span>
          <span className="rounded-full bg-white/60 border border-amber-500/20 px-2.5 py-1 text-[10px] sm:text-xs text-amber-700 dark:bg-transparent dark:text-amber-300">
            Албан ёсны бүртгэл нээлттэй
          </span>
        </div>
        <div className="mt-2 sm:mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          <div className="rounded-lg bg-white/70 border border-amber-200 p-2.5 sm:p-4 dark:bg-zinc-900 dark:border-amber-800">
            <p className="text-[11px] sm:text-xs font-medium text-amber-700 dark:text-amber-300">Шалгалтын өдөр</p>
            <p className="mt-0.5 font-bold text-[15px] sm:text-xl">10-р сарын 28, 29, 30</p>
          </div>
          <div className="rounded-lg bg-white/70 border border-amber-200 p-2.5 sm:p-4 dark:bg-zinc-900 dark:border-amber-800">
            <p className="text-[11px] sm:text-xs font-medium text-amber-700 dark:text-amber-300">Бүртгэл (8.14 – 9.27)</p>
            <a
              href="https://burtgel.mglbar.mn/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block font-bold text-[15px] sm:text-xl text-zinc-900 dark:text-white hover:underline break-all"
            >
              burtgel.mglbar.mn →
            </a>
          </div>
        </div>
        <p className="mt-2 text-[11px] sm:text-sm text-amber-700 dark:text-amber-300 leading-snug">
          Бүртгэл 9-р сарын 27-нд хаагдана — шалгалтдаа одоо бэлдэж эхэл.
        </p>
      </div>

      <HomeContinue />

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-4">
        <div className="rounded-lg sm:rounded-xl border bg-white p-2.5 sm:p-4 dark:bg-zinc-900 dark:border-zinc-800 text-center">
          <p className="text-[17px] sm:text-2xl font-bold leading-none">{total}</p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Нийт асуулт</p>
        </div>
        <div className="rounded-lg sm:rounded-xl border bg-white p-2.5 sm:p-4 dark:bg-zinc-900 dark:border-zinc-800 text-center">
          <p className="text-[17px] sm:text-2xl font-bold leading-none">{mainCount}</p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Үндсэн ангилал</p>
        </div>
        <div className="rounded-lg sm:rounded-xl border bg-white p-2.5 sm:p-4 dark:bg-zinc-900 dark:border-zinc-800 text-center">
          <p className="text-[17px] sm:text-2xl font-bold leading-none">{subCount}</p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Дэд ангилал</p>
        </div>
        <div className="rounded-lg sm:rounded-xl border bg-white p-2.5 sm:p-4 dark:bg-zinc-900 dark:border-zinc-800 text-center">
          <p className="text-[17px] sm:text-2xl font-bold leading-none">2</p>
          <p className="text-[10px] sm:text-sm text-zinc-500 mt-0.5">Шалгалт + Сургалт</p>
        </div>
      </div>

      {/* QUICK START */}
      <div>
        <div className="flex items-end justify-between gap-2 px-0.5">
          <h2 className="font-semibold text-[14px] sm:text-lg">Хаанаас эхлэх вэ?</h2>
          <Link href="/quiz" className="text-[11px] sm:text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            Тохиргоо →
          </Link>
        </div>
        <div className="mt-2 sm:mt-3 grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-4">
          <Link
            href="/browse"
            className="group rounded-xl sm:rounded-2xl border bg-white p-3 sm:p-5 dark:bg-zinc-900 dark:border-zinc-800 hover:border-zinc-400 hover:shadow-sm transition-all"
          >
            <p className="text-[11px] sm:text-xs font-medium text-zinc-500">01 — Судлах</p>
            <p className="mt-0.5 font-semibold text-[13px] sm:text-base">Бүх асуулт үзэх</p>
            <p className="mt-1 text-[11px] sm:text-sm text-zinc-500 leading-snug">
              Хайлт, үндсэн + дэд шүүлтүүр, хуудаслалт. Зөв хариултаа нууж/харуулж давт.
            </p>
            <p className="mt-2 text-[12px] sm:text-sm font-medium group-hover:translate-x-0.5 transition-transform">Үзэх →</p>
          </Link>
          <Link
            href="/quiz"
            className="group rounded-xl sm:rounded-2xl border border-zinc-900 bg-zinc-900 p-3 sm:p-5 text-white dark:bg-white dark:text-zinc-900 dark:border-white hover:shadow-sm transition-all"
          >
            <p className="text-[11px] sm:text-xs font-medium opacity-60">02 — Шалгалт</p>
            <p className="mt-0.5 font-semibold text-[13px] sm:text-base">Цагтай шалгалт өгөх</p>
            <p className="mt-1 text-[11px] sm:text-sm opacity-70 leading-snug">
              Тоо, ангилал, хугацаагаа сонго. Төгсгөлд дүн + алдааны задаргаа гарна.
            </p>
            <p className="mt-2 text-[12px] sm:text-sm font-medium group-hover:translate-x-0.5 transition-transform">Эхлэх →</p>
          </Link>
          <Link
            href="/history"
            className="group rounded-xl sm:rounded-2xl border bg-white p-3 sm:p-5 dark:bg-zinc-900 dark:border-zinc-800 hover:border-zinc-400 hover:shadow-sm transition-all"
          >
            <p className="text-[11px] sm:text-xs font-medium text-zinc-500">03 — Ахиц</p>
            <p className="mt-0.5 font-semibold text-[13px] sm:text-base">Түүхээ хянах</p>
            <p className="mt-1 text-[11px] sm:text-sm text-zinc-500 leading-snug">
              Оноо, хувь, зарцуулсан цаг. Нэвтэрсэн бол бүх төхөөрөмжид хадгалагдана.
            </p>
            <p className="mt-2 text-[12px] sm:text-sm font-medium group-hover:translate-x-0.5 transition-transform">Түүх →</p>
          </Link>
        </div>
      </div>

      {/* TOP CATEGORIES */}
      {topMains.length > 0 && (
        <div className="rounded-xl sm:rounded-2xl border bg-white p-3 sm:p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="font-semibold text-[13px] sm:text-lg">Их асуулттай ангилал</h2>
              <p className="text-[11px] sm:text-sm text-zinc-500">Шууд сонгоод бэлдэж эхэл</p>
            </div>
            <Link href="/browse" className="shrink-0 text-[11px] sm:text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
              Бүгд →
            </Link>
          </div>
          <div className="mt-2 sm:mt-4 grid grid-cols-3 gap-1.5 sm:gap-3">
            {topMains.map((m) => (
              <Link
                key={m.name}
                href={`/browse?cat=${encodeURIComponent(m.name)}`}
                className="rounded-lg sm:rounded-xl bg-zinc-50 border p-2.5 sm:p-4 text-center hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700 transition-colors"
              >
                <p className="font-bold text-[15px] sm:text-2xl leading-none">{m.total}</p>
                <p className="mt-1 text-[10px] sm:text-sm font-medium leading-tight line-clamp-2">{m.name}</p>
                <p className="mt-0.5 text-[10px] sm:text-xs text-zinc-500">{m.subs.length} дэд</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* CATEGORIES */}
      <div className="rounded-xl sm:rounded-2xl border border-dashed bg-white p-3 sm:p-6 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold text-[13px] sm:text-base">Бүх ангилал</h2>
            <p className="text-[11px] sm:text-sm text-zinc-500">Үндсэн → дэд ангиллаар шүүж үзээрэй</p>
          </div>
          <Link href="/browse" className="shrink-0 text-[11px] sm:text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            Хайлт →
          </Link>
        </div>
        <HomeCategories mains={mains} />
      </div>

      {/* HOW IT WORKS */}
      <div className="rounded-xl sm:rounded-2xl border bg-white p-3 sm:p-6 dark:bg-zinc-900 dark:border-zinc-800">
        <h2 className="font-semibold text-[13px] sm:text-lg">Хэрхэн ажилладаг вэ?</h2>
        <div className="mt-2 sm:mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          {[
            { n: "1", t: "Ангиллаа сонго", d: "Үндсэн + дэд ангилал, асуултын тоо, хугацаагаа тохируул." },
            { n: "2", t: "Шалгалт өг", d: "Шалгалтын горимоор цагтай, сургалтын горимоор шууд шалгаж бэлд." },
            { n: "3", t: "Алдаагаа давт", d: "Дүнгийн задаргаанаас буруугаа харж, Browse дээр эргэн үз." },
          ].map((s) => (
            <div key={s.n} className="flex gap-2.5 sm:gap-3 rounded-lg bg-zinc-50 border p-2.5 sm:p-4 dark:bg-zinc-800 dark:border-zinc-700">
              <span className="flex h-6 w-6 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white text-[11px] sm:text-sm font-bold dark:bg-white dark:text-zinc-900">
                {s.n}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-[12px] sm:text-sm">{s.t}</p>
                <p className="mt-0.5 text-[11px] sm:text-sm text-zinc-500 leading-snug">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div>
        <h2 className="font-semibold text-[14px] sm:text-lg px-0.5">Боломжууд</h2>
        <div className="mt-2 sm:mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-4">
          {[
            { t: "Цагтай шалгалт", d: "10 / 20 / 30 / 60 мин эсвэл хязгааргүй." },
            { t: "Сургалтын горим", d: "Асуулт бүрд хариугаа шууд шалга." },
            { t: "Дүнгийн задаргаа", d: "Зөв / буруу, зөв хариулттай харьцуул." },
            { t: "Хэлэлцүүлэг", d: "Эргэлзээтэй асуултыг бусадтай ярилц." },
            { t: "Санал хураалт", d: "Хариултгүй асуултад санал өгч тодруул." },
            { t: "Түүх хадгалах", d: "Нэвтэрвэл бүх төхөөрөмжид синк." },
          ].map((f) => (
            <div
              key={f.t}
              className="rounded-lg sm:rounded-xl border bg-white p-2.5 sm:p-4 dark:bg-zinc-900 dark:border-zinc-800"
            >
              <p className="font-semibold text-[12px] sm:text-sm">{f.t}</p>
              <p className="mt-0.5 text-[11px] sm:text-sm text-zinc-500 leading-snug">{f.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-xl sm:rounded-2xl border bg-zinc-50 p-4 sm:p-8 text-center dark:bg-zinc-800 dark:border-zinc-700">
        <h2 className="font-semibold text-[14px] sm:text-xl">Бэлэн үү? Эхний шалгалтаа өг.</h2>
        <p className="mt-1 text-[11px] sm:text-sm text-zinc-500">
          20 асуулт · ~10 минут · үр дүн шууд гарна
        </p>
        <div className="mt-3 sm:mt-5 flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
          <Link
            href="/quiz"
            className="rounded-full bg-zinc-900 px-6 py-2.5 sm:px-8 sm:py-3 text-[13px] sm:text-sm font-medium text-white dark:bg-white dark:text-zinc-900 min-h-[40px] flex items-center justify-center"
          >
            Шалгалт эхлэх
          </Link>
          <Link
            href="/login"
            className="rounded-full border px-6 py-2.5 sm:px-8 sm:py-3 text-[13px] sm:text-sm font-medium dark:border-zinc-600 min-h-[40px] flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700"
          >
            Утсаар бүртгүүлэх
          </Link>
        </div>
      </div>
    </div>
  );
}
