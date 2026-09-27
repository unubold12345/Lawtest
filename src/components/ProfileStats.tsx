"use client";
import { useMemo } from "react";
import Link from "next/link";
import { computeStats, fmtDur, type RawAttempt } from "@/lib/profileStats";

const cardCls = "rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:bg-white/[0.04] dark:border-white/10";
const tileCls = "rounded-2xl border border-zinc-200 bg-white p-4 dark:bg-white/[0.04] dark:border-white/10";
const labelCls = "text-xs text-zinc-500";

export default function ProfileStats({ attempts, totalWrong }: { attempts: RawAttempt[]; totalWrong: number }) {
  const s = useMemo(() => computeStats(attempts), [attempts]);

  if (s.n === 0) {
    return (
      <div className={`${cardCls} text-center`}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Одоогоор шалгалт өгөөгүй байна.</p>
        <p className="mt-1 text-xs text-zinc-500">Статистик энд харагдана.</p>
        <Link href="/quiz" className="mt-4 inline-flex rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[44px] items-center">
          Шалгалт эхлэх
        </Link>
      </div>
    );
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("mn-MN", { year: "numeric", month: "2-digit", day: "2-digit" });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { n: String(s.n), label: "Нийт шалгалт" },
          { n: fmtDur(s.totalElapsed), label: "Зарцуулсан цаг" },
          { n: s.avgPct !== null ? `${s.avgPct}%` : "—", label: "Дундаж оноо" },
          { n: s.bestPct !== null ? `${s.bestPct}%` : "—", label: "Шилдэг оноо" },
          { n: s.passRate !== null ? `${s.passRate}%` : "—", label: "Тэнцсэн хувь" },
          { n: String(s.totalQuestions), label: "Нийт асуулт" },
        ].map((t) => (
          <div key={t.label} className={tileCls}>
            <p className="text-xl font-bold break-words">{t.n}</p>
            <p className={labelCls}>{t.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={cardCls}>
          <h3 className="font-semibold">Цуврал</h3>
          <div className="mt-3 flex items-end gap-6">
            <div>
              <p className="text-2xl font-bold">{s.streak}</p>
              <p className={labelCls}>өдөр дараалан</p>
            </div>
            <div>
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{s.longestStreak}</p>
              <p className={labelCls}>хамгийн урт</p>
            </div>
          </div>
        </div>
        <div className={cardCls}>
          <h3 className="font-semibold">Горимоор</h3>
          <div className="mt-3 space-y-3">
            {[
              { label: "Шалгалт", n: s.examCount, time: s.examTime, cls: "bg-indigo-500" },
              { label: "Сургалт", n: s.studyCount, time: s.studyTime, cls: "bg-violet-500" },
            ].map((m) => {
              const max = Math.max(1, s.examCount, s.studyCount);
              return (
                <div key={m.label}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span>{m.label}</span>
                    <span className="text-zinc-500">
                      {m.n} · {fmtDur(m.time)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                    <div className={`h-full rounded-full ${m.cls}`} style={{ width: `${Math.round((m.n / max) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="font-semibold">Сүүлийн 8 долоо хоног</h3>
        <div className="mt-4 flex items-end gap-1.5 sm:gap-3">
          {s.weeks.map((w) => (
            <div key={w.key} className="flex flex-1 flex-col items-center gap-1" title={w.count ? `${w.count} шалгалт · ${w.total > 0 ? Math.round((w.score / w.total) * 100) : 0}% дундаж` : "Шалгалтгүй"}>
              <span className="text-[10px] font-medium text-zinc-500 h-3.5">{w.count > 0 ? w.count : ""}</span>
              <div className="flex h-28 w-full max-w-[36px] items-end justify-center rounded-lg bg-zinc-50 dark:bg-white/[0.03]">
                <div
                  className={`w-full rounded-t-lg ${w.count > 0 ? "bg-indigo-500/80 dark:bg-indigo-400/80" : "bg-zinc-200/70 dark:bg-white/10"}`}
                  style={{ height: `${Math.max(w.count > 0 ? 6 : 2, Math.round((w.count / s.maxWeekCount) * 100))}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500">{w.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="font-semibold">Ангилалаар</h3>
        <div className="mt-3 space-y-3">
          {s.topCategories.map((c) => (
            <div key={c.category}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate">{c.category}</span>
                <span className="shrink-0 text-zinc-500">
                  {c.count} · {c.avgPct !== null ? `${c.avgPct}%` : "—"}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                <div className="h-full rounded-full bg-indigo-500/80 dark:bg-indigo-400/80" style={{ width: `${Math.round((c.count / s.maxCatCount) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="font-semibold">Бүртгэл</h3>
        <dl className="mt-3 divide-y divide-zinc-100 dark:divide-white/5">
          {[
            { k: "Анхны шалгалт", v: s.firstDate ? fmtDate(s.firstDate) : "—" },
            { k: "Сүүлийн шалгалт", v: s.lastDate ? fmtDate(s.lastDate) : "—" },
            { k: "Нэг шалгалтын дундаж хугацаа", v: fmtDur(s.avgElapsed) },
            { k: "Хамгийн урт шалгалт", v: fmtDur(s.longest) },
            { k: "Хамгийн хурдан шалгалт", v: s.fastest !== null ? fmtDur(s.fastest) : "—" },
            { k: "Хамгийн олон асуулттай", v: s.mostQuestions ? `${s.mostQuestions} асуулт` : "—" },
            { k: "Нийт зөв хариулт", v: String(s.totalScore) },
            { k: "Нийт алдсан (тэмдэглэсэн)", v: String(totalWrong) },
          ].map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-3 py-2 text-[13px] first:pt-0 last:pb-0">
              <dt className="text-zinc-500">{r.k}</dt>
              <dd className="font-medium">{r.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
