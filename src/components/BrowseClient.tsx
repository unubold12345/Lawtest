"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { Question } from "@/types/question";
import { effectiveAnswer, fileHasAnswer, getAllOverrides, setOverride } from "@/lib/answerOverrides";
import QuestionDiscussion from "@/components/QuestionDiscussion";

const PAGE_SIZE = 20;

export default function BrowseClient({ questions }: { questions: Question[] }) {
  const { data: session } = useSession();
  const isAuthed = !!session?.user;
  const [q, setQ] = useState("");
  const [mainCategory, setMainCategory] = useState<string>("all");
  const [subCategory, setSubCategory] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [myDb, setMyDb] = useState<Record<string, number>>({});
  const [counts, setCounts] = useState<Record<string, number[]>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<{ id: string; index: number } | null>(null);
  const [pendingClear, setPendingClear] = useState<string | null>(null);

  useEffect(() => {
    setOverrides(getAllOverrides());
    const onStorage = () => setOverrides(getAllOverrides());
    const onCustom = () => setOverrides(getAllOverrides());
    window.addEventListener("storage", onStorage);
    window.addEventListener("lawtest:overrides", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("lawtest:overrides", onCustom as EventListener);
    };
  }, []);

  const collator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }), []);
  const mainCategories = useMemo(() => ([...new Set(questions.map((x) => x.category).filter(Boolean))] as string[]).sort((a, b) => collator.compare(a, b)), [questions, collator]);
  const subCategories = useMemo(() => {
    let pool: typeof questions = questions;
    if (mainCategory !== "all") pool = pool.filter((x) => x.category === mainCategory);
    return ([...new Set(pool.map((x) => x.subCategory).filter(Boolean))] as string[]).sort((a, b) => collator.compare(a, b));
  }, [questions, mainCategory, collator]);

  const filtered = useMemo(() => {
    let out = questions;
    if (mainCategory !== "all") out = out.filter((x) => x.category === mainCategory);
    if (subCategory !== "all") out = out.filter((x) => x.subCategory === subCategory);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      out = out.filter(
        (x) =>
          x.question.toLowerCase().includes(s) ||
          x.options.some((o) => o.toLowerCase().includes(s)) ||
          x.category?.toLowerCase().includes(s) ||
          x.subCategory?.toLowerCase().includes(s)
      );
    }
    return out;
  }, [questions, q, mainCategory, subCategory]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // fetch vote counts for saveable page items (public, my vote if authed)
  useEffect(() => {
    const ids = paged.filter((x) => !fileHasAnswer(x)).map((x) => x.id);
    if (ids.length === 0) return;
    fetch(`/api/saved-answers?ids=${encodeURIComponent(ids.join(","))}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.counts) setCounts((prev) => ({ ...prev, ...d.counts }));
        if (d.my) setMyDb((prev) => ({ ...prev, ...d.my }));
      })
      .catch(() => {});
  }, [paged.map((x) => x.id).join(",")]);

  // reset page when filters change
  const onSearch = (v: string) => { setQ(v); setPage(1); };
  const onMain = (v: string) => { setMainCategory(v); setSubCategory("all"); setPage(1); };
  const onSub = (v: string) => { setSubCategory(v); setPage(1); };

  const letters = ["A", "B", "C", "D", "E"];

  return (
    <div className="space-y-3 sm:space-y-6 px-3 sm:px-0">
      {/* controls */}
      <div className="rounded-xl sm:rounded-2xl border bg-white p-3 sm:p-4 dark:bg-zinc-900 dark:border-zinc-800 space-y-2 sm:space-y-3">
        <input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Хайх... асуулт эсвэл хариулт"
          className="w-full rounded-full border px-3 py-2 sm:px-4 sm:py-2 text-[13px] sm:text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:bg-zinc-800 dark:border-zinc-700"
        />
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          <select
            value={mainCategory}
            onChange={(e) => onMain(e.target.value)}
            className="w-full rounded-lg sm:rounded-full border px-2 py-2 sm:px-4 sm:py-2 text-[12px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[44px]"
          >
            <option value="all">Бүх үндсэн ({questions.length})</option>
            {mainCategories.map((c) => (
              <option key={c} value={c}>{c} ({questions.filter((x) => x.category === c).length})</option>
            ))}
          </select>
          <select
            value={subCategory}
            onChange={(e) => onSub(e.target.value)}
            className="w-full rounded-lg sm:rounded-full border px-2 py-2 sm:px-4 sm:py-2 text-[12px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[44px]"
            disabled={mainCategory === "all" && subCategories.length === 0}
          >
            <option value="all">Бүх дэд ({filtered.length})</option>
            {subCategories.map((c) => (
              <option key={c} value={c}>{c} ({questions.filter((x) => (mainCategory === "all" || x.category === mainCategory) && x.subCategory === c).length})</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-[11px] sm:text-sm text-zinc-500 px-1">{filtered.length} асуулт · {totalPages} хуудас</p>

      <div className="grid gap-2 sm:gap-4">
        {paged.map((item, idx) => {
          const locked = fileHasAnswer(item);
          const dbAns = myDb[item.id];
          const localAns = overrides[item.id];
          const eff: number | null = locked
            ? (typeof item.answer === "number" ? item.answer : (Array.isArray(item.answer) ? (item.answer as number[])[0] : null))
            : isAuthed
              ? (typeof dbAns === "number" ? dbAns : null)
              : (typeof localAns === "number" ? localAns : null);
          const hasOverride = !locked && (isAuthed ? typeof dbAns === "number" : typeof localAns === "number");
          const isUnknown = eff === null;
          const isRevealed = !!revealed[item.id];
          const globalIdx = (page - 1) * PAGE_SIZE + idx + 1;
          const voteCounts: number[] = counts[item.id] || [];
          const totalVotes = voteCounts.reduce((a, b) => a + b, 0);
          return (
            <div key={item.id} className="rounded-xl sm:rounded-2xl border bg-white p-3 sm:p-6 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-4">
                <p className="font-medium leading-snug text-[13px] sm:text-base break-words"><span className="mr-1.5 text-zinc-400 text-[11px] sm:text-sm">{globalIdx}.</span>{item.question}</p>
                <div className="flex gap-1 shrink-0 flex-wrap">
                  {item.category && <span className="rounded-full bg-zinc-900 text-white px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs dark:bg-white dark:text-zinc-900">{item.category}</span>}
                  {item.subCategory && <span className="rounded-full bg-zinc-100 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs dark:bg-zinc-800">{item.subCategory}</span>}
                </div>
              </div>
              {locked && !isUnknown && (
                <button
                  onClick={() => setRevealed((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className="mt-2 sm:mt-3 rounded-full border px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {isRevealed ? "Нуух" : "Зөв хариулт харах"}
                </button>
              )}
              <div className="mt-3 sm:mt-4 grid gap-1.5 sm:gap-2">
                {item.options.map((opt, i) => {
                  const isCorrect = eff !== null && i === eff;
                  return (
                    <div
                      key={i}
                      className={`rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm flex gap-2 sm:gap-3 ${isRevealed && isCorrect ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950" : "border-zinc-200 dark:border-zinc-700"}`}
                    >
                      <span className={`flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold ${isRevealed && isCorrect ? "bg-green-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>{letters[i]}</span>
                      <span className="leading-snug">{opt}</span>
                      {isRevealed && isCorrect && <span className="ml-auto text-green-700 dark:text-green-300 font-medium text-xs">✓</span>}
                      {isRevealed && hasOverride && isCorrect && <span className="ml-auto text-[9px] leading-none rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Та хадгалсан</span>}
                    </div>
                  );
                })}
              </div>
              {isRevealed && item.explanation && <p className="mt-2 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">Тайлбар: {item.explanation}</p>}

              {/* Discussion for saveable questions */}
              {!locked && <QuestionDiscussion questionId={item.id} />}

              {/* Only questions with no file answer can be assigned a correct answer */}
              {!locked && (
                <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl border border-dashed p-2.5 sm:p-3 dark:border-zinc-700">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <p className="text-[11px] sm:text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {isUnknown ? "Зөв хариулт тодорхойгүй — сонгоод хадгална уу:" : `Та энэ хариултыг хадгалсан: ${letters[eff!]} — өөрчлөх:`}
                    </p>
                    {hasOverride && (
                      <button
                        onClick={() => setPendingClear(item.id)}
                        className="text-[11px] sm:text-xs underline text-zinc-500"
                      >
                        Арилгах
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                    {item.options.map((_, i) => {
                      const c = voteCounts[i] || 0;
                      return (
                        <button
                          key={i}
                          onClick={() => setPending({ id: item.id, index: i })}
                          className={`rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-[12px] sm:text-sm border flex items-center gap-1 min-h-[32px] sm:min-h-[44px] ${eff === i ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-50 dark:border-zinc-700"}`}
                        >
                          <span>{letters[i]}</span>
                          <span className={`text-[11px] sm:text-xs ${eff === i ? "text-white/70 dark:text-zinc-500" : "text-zinc-500"}`}>· {c}</span>
                        </button>
                      );
                    })}
                  </div>
                  {totalVotes > 0 && (
                    <p className="mt-1.5 text-[10px] sm:text-xs text-zinc-500">
                      Нийт {totalVotes} хүн санал өгсөн
                      {(() => {
                        let max = -1, maxIdx = -1;
                        voteCounts.forEach((v, i) => { if (v > max) { max = v; maxIdx = i; } });
                        const leaders = voteCounts.filter((v) => v === max).length === 1 && max > 0 ? ` · хамгийн их: ${letters[maxIdx]} (${max})` : "";
                        return leaders;
                      })()}
                    </p>
                  )}
                  {!isUnknown && hasOverride && <p className="mt-1 text-[10px] sm:text-[11px] text-amber-700 dark:text-amber-300">Та энэ хариултыг хадгалсан — хүссэн үедээ сольж болно.</p>}
                </div>
              )}


            </div>
          );
        })}
      </div>

      {filtered.length === 0 && <p className="text-center py-12 text-zinc-500">Илэрц олдсонгүй.</p>}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-full border px-5 py-3 sm:py-2 text-sm disabled:opacity-40 dark:border-zinc-700 min-h-[44px]">Өмнөх</button>
          <span className="text-sm min-w-[60px] text-center">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-full border px-5 py-3 sm:py-2 text-sm disabled:opacity-40 dark:border-zinc-700 min-h-[44px]">Дараах</button>
        </div>
      )}

      {/* confirm save */}
      {pending && (() => {
        const pq = questions.find((x) => x.id === pending.id);
        if (!pq) return null;
        const curEff = isAuthed ? (myDb[pq.id] ?? null) : (overrides[pq.id] ?? null);
        const isChange = curEff !== null && curEff !== pending.index;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setPending(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 dark:border dark:border-zinc-800">
              <h3 className="font-semibold">{isChange ? "Зөв хариултыг солих уу?" : "Зөв хариулт хадгалах уу?"}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">{pq.question}</p>
              <div className="mt-4 rounded-xl border bg-zinc-50 px-4 py-3 dark:bg-zinc-800 dark:border-zinc-700">
                <p className="text-sm"><span className="font-bold">{letters[pending.index]}.</span> {pq.options[pending.index]}</p>
                {curEff !== null && <p className="mt-1 text-xs text-zinc-500">Одоогийн: {letters[curEff]} · Шинэ: {letters[pending.index]}</p>}
              </div>
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Андуурч дарсан бол Цуцлах дарна уу — шууд хадгалагдахгүй.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setPending(null)} className="rounded-full border px-5 py-2 text-sm dark:border-zinc-700">Цуцлах</button>
                <button
                  onClick={async () => {
                    const { id, index } = pending;
                    if (isAuthed) {
                      try {
                        const r = await fetch("/api/saved-answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: id, answer: index }) });
                        if (r.ok) {
                          setMyDb((prev) => ({ ...prev, [id]: index }));
                          // refetch counts
                          fetch(`/api/saved-answers?ids=${encodeURIComponent(id)}`).then((rr) => rr.json()).then((d) => { if (d.counts) setCounts((p) => ({ ...p, ...d.counts })); });
                        } else {
                          setOverride(id, index); setOverrides(getAllOverrides());
                        }
                      } catch { setOverride(id, index); setOverrides(getAllOverrides()); }
                    } else {
                      setOverride(id, index); setOverrides(getAllOverrides());
                    }
                    setPending(null);
                  }}
                  className="rounded-full bg-zinc-900 px-6 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
                >
                  Хадгалах
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* confirm clear */}
      {pendingClear && (() => {
        const pq = questions.find((x) => x.id === pendingClear);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setPendingClear(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 dark:border dark:border-zinc-800">
              <h3 className="font-semibold">Хадгалсан хариултыг арилгах уу?</h3>
              {pq && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">{pq.question}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setPendingClear(null)} className="rounded-full border px-5 py-2 text-sm dark:border-zinc-700">Цуцлах</button>
                <button
                  onClick={async () => {
                    const id = pendingClear as string;
                    if (isAuthed) {
                      try {
                        const r = await fetch("/api/saved-answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: id, answer: null }) });
                        if (r.ok) {
                          setMyDb((prev) => { const n = { ...prev }; delete n[id]; return n; });
                          fetch(`/api/saved-answers?ids=${encodeURIComponent(id)}`).then((rr) => rr.json()).then((d) => { if (d.counts) setCounts((p) => ({ ...p, ...d.counts })); });
                        } else {
                          setOverride(id, null); setOverrides(getAllOverrides());
                        }
                      } catch { setOverride(id, null); setOverrides(getAllOverrides()); }
                    } else {
                      setOverride(id, null); setOverrides(getAllOverrides());
                    }
                    setPendingClear(null);
                  }}
                  className="rounded-full bg-red-600 px-6 py-2 text-sm font-medium text-white"
                >
                  Арилгах
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
