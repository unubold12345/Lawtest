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
  const [category, setCategory] = useState<string>("all");
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

  const categories = useMemo(() => [...new Set(questions.map((x) => x.category).filter(Boolean))] as string[], [questions]);

  const filtered = useMemo(() => {
    let out = questions;
    if (category !== "all") out = out.filter((x) => x.category === category);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      out = out.filter(
        (x) =>
          x.question.toLowerCase().includes(s) ||
          x.options.some((o) => o.toLowerCase().includes(s)) ||
          x.category?.toLowerCase().includes(s)
      );
    }
    return out;
  }, [questions, q, category]);

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
  const onCat = (v: string) => { setCategory(v); setPage(1); };

  const letters = ["A", "B", "C", "D", "E"];

  return (
    <div className="space-y-6">
      {/* controls */}
      <div className="rounded-2xl border bg-white p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-1 items-center gap-3">
          <input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Хайх... асуулт эсвэл хариулт"
            className="w-full max-w-md rounded-full border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:bg-zinc-800 dark:border-zinc-700"
          />
          <select
            value={category}
            onChange={(e) => onCat(e.target.value)}
            className="rounded-full border px-4 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700"
          >
            <option value="all">Бүх ангилал ({questions.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c} ({questions.filter((x) => x.category === c).length})</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-zinc-500">{filtered.length} асуулт олдлоо · {totalPages} хуудас</p>

      <div className="grid gap-4">
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
            <div key={item.id} className="rounded-2xl border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium leading-relaxed"><span className="mr-2 text-zinc-400">{globalIdx}.</span>{item.question}</p>
                {item.category && <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs dark:bg-zinc-800">{item.category}</span>}
              </div>
              {locked && !isUnknown && (
                <button
                  onClick={() => setRevealed((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className="mt-3 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {isRevealed ? "Нуух" : "Зөв хариулт харах"}
                </button>
              )}
              <div className="mt-4 grid gap-2">
                {item.options.map((opt, i) => {
                  const isCorrect = eff !== null && i === eff;
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border px-4 py-3 text-sm flex gap-3 ${isRevealed && isCorrect ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950" : "border-zinc-200 dark:border-zinc-700"}`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isRevealed && isCorrect ? "bg-green-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>{letters[i]}</span>
                      <span>{opt}</span>
                      {isRevealed && isCorrect && <span className="ml-auto text-green-700 dark:text-green-300 font-medium">✓ Зөв</span>}
                      {isRevealed && hasOverride && isCorrect && <span className="ml-auto text-[10px] leading-none rounded-full bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Та хадгалсан</span>}
                    </div>
                  );
                })}
              </div>
              {isRevealed && item.explanation && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Тайлбар: {item.explanation}</p>}

              {/* Discussion for saveable questions */}
              {!locked && <QuestionDiscussion questionId={item.id} />}

              {/* Only questions with no file answer can be assigned a correct answer */}
              {!locked && (
                <div className="mt-4 rounded-xl border border-dashed p-3 dark:border-zinc-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {isUnknown ? "Зөв хариулт тодорхойгүй — сонгоод хадгална уу:" : `Та энэ хариултыг хадгалсан: ${letters[eff!]} — өөрчлөх:`}
                    </p>
                    {hasOverride && (
                      <button
                        onClick={() => setPendingClear(item.id)}
                        className="text-xs underline text-zinc-500"
                      >
                        Арилгах
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.options.map((_, i) => {
                      const c = voteCounts[i] || 0;
                      return (
                        <button
                          key={i}
                          onClick={() => setPending({ id: item.id, index: i })}
                          className={`rounded-full px-4 py-2 text-sm border flex items-center gap-1.5 ${eff === i ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-50 dark:border-zinc-700"}`}
                        >
                          <span>{letters[i]}</span>
                          <span className={`text-xs ${eff === i ? "text-white/70 dark:text-zinc-500" : "text-zinc-500"}`}>· {c}</span>
                        </button>
                      );
                    })}
                  </div>
                  {totalVotes > 0 && (
                    <p className="mt-2 text-xs text-zinc-500">
                      Нийт {totalVotes} хүн санал өгсөн
                      {(() => {
                        let max = -1, maxIdx = -1;
                        voteCounts.forEach((v, i) => { if (v > max) { max = v; maxIdx = i; } });
                        const leaders = voteCounts.filter((v) => v === max).length === 1 && max > 0 ? ` · хамгийн их: ${letters[maxIdx]} (${max})` : "";
                        return leaders;
                      })()}
                    </p>
                  )}
                  {!isUnknown && hasOverride && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Та энэ хариултыг хадгалсан — хүссэн үедээ сольж болно.</p>}
                </div>
              )}


            </div>
          );
        })}
      </div>

      {filtered.length === 0 && <p className="text-center py-12 text-zinc-500">Илэрц олдсонгүй.</p>}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-full border px-4 py-2 text-sm disabled:opacity-40 dark:border-zinc-700">Өмнөх</button>
          <span className="text-sm">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-full border px-4 py-2 text-sm disabled:opacity-40 dark:border-zinc-700">Дараах</button>
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
