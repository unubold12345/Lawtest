"use client";
import { useMemo, useState } from "react";
import type { Question } from "@/types/question";

const PAGE_SIZE = 20;

export default function BrowseClient({ questions }: { questions: Question[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [showAnswers, setShowAnswers] = useState(false);
  const [page, setPage] = useState(1);

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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} className="rounded" />
          Зөв хариулт харуулах
        </label>
      </div>

      <p className="text-sm text-zinc-500">{filtered.length} асуулт олдлоо · {totalPages} хуудас</p>

      <div className="grid gap-4">
        {paged.map((item, idx) => {
          const ans = typeof item.answer === "number" ? item.answer : item.answer[0];
          const globalIdx = (page - 1) * PAGE_SIZE + idx + 1;
          return (
            <div key={item.id} className="rounded-2xl border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium leading-relaxed"><span className="mr-2 text-zinc-400">{globalIdx}.</span>{item.question}</p>
                {item.category && <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs dark:bg-zinc-800">{item.category}</span>}
              </div>
              <div className="mt-4 grid gap-2">
                {item.options.map((opt, i) => {
                  const isCorrect = i === ans;
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border px-4 py-3 text-sm flex gap-3 ${showAnswers && isCorrect ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950" : "border-zinc-200 dark:border-zinc-700"}`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${showAnswers && isCorrect ? "bg-green-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>{letters[i]}</span>
                      <span>{opt}</span>
                      {showAnswers && isCorrect && <span className="ml-auto text-green-700 dark:text-green-300 font-medium">✓ Зөв</span>}
                    </div>
                  );
                })}
              </div>
              {showAnswers && item.explanation && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Тайлбар: {item.explanation}</p>}
              <p className="mt-2 text-xs text-zinc-400">{item.id} {item.year ? `· ${item.year}` : ""}</p>
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
    </div>
  );
}
