"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Question } from "@/types/question";
import { fileHasAnswer, getAllOverrides, setOverride } from "@/lib/answerOverrides";
import QuestionDiscussion from "@/components/QuestionDiscussion";
import QuestionReport from "@/components/QuestionReport";

const PAGE_SIZE = 20;
const LETTERS = ["A", "B", "C", "D", "E"];

type Status = "all" | "answered" | "unanswered" | "mine";

export default function BrowseClient({ questions }: { questions: Question[] }) {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isAuthed = !!session?.user;
  const searchRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState("");
  const [mainCategory, setMainCategory] = useState<string>(() => searchParams.get("cat") || "all");
  const [subCategory, setSubCategory] = useState<string>(() => searchParams.get("sub") || "all");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [myDb, setMyDb] = useState<Record<string, number>>({});
  const [counts, setCounts] = useState<Record<string, number[]>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState<Record<string, string>>({});
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

  // guard against invalid ?cat= / ?sub= from links
  useEffect(() => {
    if (mainCategory !== "all" && !mainCategories.includes(mainCategory)) {
      setMainCategory("all");
      setSubCategory("all");
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainCategories]);
  useEffect(() => {
    if (subCategory !== "all" && !subCategories.includes(subCategory)) {
      setSubCategory("all");
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subCategories]);

  // ---- answer state helpers ----
  const effOf = (item: Question): number | null => {
    if (fileHasAnswer(item)) {
      if (typeof item.answer === "number") return item.answer;
      if (Array.isArray(item.answer)) return (item.answer as number[])[0] ?? null;
      return null;
    }
    if (isAuthed) return typeof myDb[item.id] === "number" ? (myDb[item.id] as number) : null;
    return typeof overrides[item.id] === "number" ? (overrides[item.id] as number) : null;
  };
  const mineOf = (item: Question): boolean => {
    if (fileHasAnswer(item)) return false;
    return isAuthed ? typeof myDb[item.id] === "number" : typeof overrides[item.id] === "number";
  };
  const statusOf = (item: Question): "answered" | "unanswered" | "mine" =>
    mineOf(item) ? "mine" : effOf(item) === null ? "unanswered" : "answered";

  const filteredBase = useMemo(() => {
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

  const statusCounts = useMemo(() => {
    let answered = 0, unanswered = 0, mine = 0;
    filteredBase.forEach((x) => {
      const s = statusOf(x);
      if (s === "mine") mine++;
      else if (s === "answered") answered++;
      else unanswered++;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return { answered, unanswered, mine, total: filteredBase.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredBase, myDb, overrides, isAuthed]);

  const filtered = useMemo(() => {
    if (status === "all") return filteredBase;
    return filteredBase.filter((x) => statusOf(x) === status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredBase, status, myDb, overrides, isAuthed]);

  const readyPct = statusCounts.total === 0 ? 0 : Math.round(((statusCounts.answered + statusCounts.mine) / statusCounts.total) * 100);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paged.map((x) => x.id).join(",")]);

  const onSearch = (v: string) => { setQ(v); setPage(1); };
  const onMain = (v: string) => { setMainCategory(v); setSubCategory("all"); setPage(1); };
  const onSub = (v: string) => { setSubCategory(v); setPage(1); };
  const onStatus = (v: Status) => { setStatus(v); setPage(1); };

  // ---- saving ----
  const persistAnswer = async (id: string, index: number | null) => {
    if (isAuthed) {
      try {
        const r = await fetch("/api/saved-answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: id, answer: index }) });
        if (r.ok) {
          if (index === null) {
            setMyDb((prev) => { const n = { ...prev }; delete n[id]; return n; });
          } else {
            setMyDb((prev) => ({ ...prev, [id]: index }));
          }
          fetch(`/api/saved-answers?ids=${encodeURIComponent(id)}`).then((rr) => rr.json()).then((d) => { if (d.counts) setCounts((p) => ({ ...p, ...d.counts })); }).catch(() => {});
          return;
        }
      } catch { /* fall through to local */ }
    }
    setOverride(id, index);
    setOverrides(getAllOverrides());
  };

  const flashSaved = (id: string, text: string) => {
    setFlash((p) => ({ ...p, [id]: text }));
    window.setTimeout(() => setFlash((p) => { const n = { ...p }; delete n[id]; return n; }), 2600);
  };

  const chooseAnswer = (id: string, index: number) => {
    setPending({ id, index });
  };

  const toggleExpand = (id: string) => {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
    setActiveId(id);
  };

  // ---- keyboard: / search · J/K move · Esc close ----
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "Escape") {
        if (pending) setPending(null);
        else if (pendingClear) setPendingClear(null);
        else if (!typing && activeId) setExpanded((p) => ({ ...p, [activeId]: false }));
        return;
      }
      if (typing || pending || pendingClear) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (paged.length === 0) return;
      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        const at = paged.findIndex((x) => x.id === activeId);
        const nxt = paged[(at + 1 + paged.length) % paged.length];
        setExpanded((p) => ({ ...p, [nxt.id]: true }));
        setActiveId(nxt.id);
        requestAnimationFrame(() => document.getElementById(`qrow-${nxt.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
        return;
      }
      if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        const at = paged.findIndex((x) => x.id === activeId);
        const prv = paged[(at - 1 + paged.length) % paged.length];
        setExpanded((p) => ({ ...p, [prv.id]: true }));
        setActiveId(prv.id);
        requestAnimationFrame(() => document.getElementById(`qrow-${prv.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
        return;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, paged, myDb, overrides, isAuthed, pending, pendingClear]);

  // quiz link preserves current view (prep flow)
  const quizHref = (() => {
    const sp = new URLSearchParams();
    if (mainCategory !== "all") sp.set("main", mainCategory);
    if (subCategory !== "all") sp.set("sub", subCategory);
    if (q.trim()) sp.set("q", q.trim());
    const s = sp.toString();
    return s ? `/quiz?${s}` : "/quiz";
  })();

  const pageWindow = useMemo(() => {
    const win = new Set<number>([1, totalPages, safePage - 1, safePage, safePage + 1]);
    return [...win].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  }, [safePage, totalPages]);

  const statusPills: { id: Status; label: string; n: number }[] = [
    { id: "all", label: "Бүгд", n: statusCounts.total },
    { id: "answered", label: "● Хариулттай", n: statusCounts.answered + statusCounts.mine },
    { id: "unanswered", label: "○ Хариултгүй", n: statusCounts.unanswered },
    { id: "mine", label: "✓ Минийх", n: statusCounts.mine },
  ];

  return (
    <div className="space-y-3 sm:space-y-4 px-3 sm:px-0">
      {/* controls */}
      <div className="rounded-xl sm:rounded-2xl border bg-white p-3 sm:p-4 dark:bg-zinc-900 dark:border-zinc-800 space-y-2 sm:space-y-3">
        <input
          ref={searchRef}
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
            <option value="all">Бүх дэд ({filteredBase.length})</option>
            {subCategories.map((c) => (
              <option key={c} value={c}>{c} ({questions.filter((x) => (mainCategory === "all" || x.category === mainCategory) && x.subCategory === c).length})</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {statusPills.map((p) => (
            <button
              key={p.id}
              onClick={() => onStatus(p.id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] sm:text-xs font-medium min-h-[32px] sm:min-h-[36px] ${status === p.id ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}
            >
              {p.label} · {p.n}
            </button>
          ))}
        </div>
        <div className="hidden sm:flex flex-wrap items-center justify-end gap-2 border-t pt-2 dark:border-zinc-800">
          <span className="text-[11px] text-zinc-400">Товчлол: / хайлт · J/K шилжих · Esc хаах</span>
        </div>
      </div>

      {/* readiness + practice */}
      <div className="rounded-xl sm:rounded-2xl border bg-white p-3 sm:p-4 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] sm:text-sm font-medium">Шалгалтад бэлэн: {readyPct}%</p>
          <p className="text-[11px] sm:text-xs text-zinc-500">{statusCounts.answered + statusCounts.mine}/{statusCounts.total} хариулттай</p>
        </div>
        <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-zinc-900 dark:bg-white transition-all" style={{ width: `${readyPct}%` }} />
        </div>
        <Link
          href={quizHref}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-[13px] sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 min-h-[40px] sm:min-h-[44px]"
        >
          Энэ шүүлтүүрээр шалгалт өгөх → <span className="opacity-70">({filteredBase.length})</span>
        </Link>
      </div>

      <p className="text-[11px] sm:text-sm text-zinc-500 px-1">● хариулттай · ○ хариултгүй · ✓ миний хадгалсан — мөр дээр дарж нээнэ</p>

      {/* compact rows */}
      <div className="grid gap-1.5 sm:gap-2">
        {paged.map((item, idx) => {
          const locked = fileHasAnswer(item);
          const eff = effOf(item);
          const mine = mineOf(item);
          const st = statusOf(item);
          const isOpen = !!expanded[item.id];
          const isActive = activeId === item.id;
          const isRevealed = !!revealed[item.id];
          const globalIdx = (safePage - 1) * PAGE_SIZE + idx + 1;
          const voteCounts: number[] = counts[item.id] || [];
          const totalVotes = voteCounts.reduce((a, b) => a + b, 0);
          const mark = st === "mine" ? "✓" : st === "answered" ? "●" : "○";
          return (
            <div key={item.id} id={`qrow-${item.id}`} className={`rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 scroll-mt-20 ${isActive ? "border-zinc-900 dark:border-white" : ""}`}>
              <button onClick={() => toggleExpand(item.id)} className="flex w-full items-start gap-2 px-3 py-2.5 sm:px-4 sm:py-3 text-left">
                <span className="shrink-0 text-[11px] sm:text-xs text-zinc-400 w-7 pt-0.5">{globalIdx}.</span>
                <span className={`shrink-0 pt-0.5 text-[13px] sm:text-sm ${st === "unanswered" ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-900 dark:text-white"} ${st === "mine" ? "font-bold" : ""}`}>{mark}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block leading-snug break-words ${isOpen ? "text-[13px] sm:text-[15px] font-medium" : "text-[12px] sm:text-sm line-clamp-2"}`}>{item.question}</span>
                  <span className="mt-0.5 block truncate text-[10px] sm:text-[11px] text-zinc-400">{item.category}{item.subCategory ? ` · ${item.subCategory}` : ""}{!locked && eff !== null ? ` · ${LETTERS[eff]}` : ""}</span>
                </span>
                <span className="shrink-0 pt-1 text-[10px] text-zinc-400">{isOpen ? "▴" : "▾"}</span>
              </button>

              {isOpen && (
                <div className="border-t px-3 py-3 sm:px-4 sm:py-4 dark:border-zinc-800">
                  <div className="flex gap-1 flex-wrap">
                    {item.category && <span className="rounded-full bg-zinc-900 text-white px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs dark:bg-white dark:text-zinc-900">{item.category}</span>}
                    {item.subCategory && <span className="rounded-full bg-zinc-100 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs dark:bg-zinc-800">{item.subCategory}</span>}
                    {!locked && mine && <span className="rounded-full bg-zinc-900 text-white px-2 py-0.5 text-[10px] sm:text-xs dark:bg-white dark:text-zinc-900">✓ Та хадгалсан</span>}
                    {!locked && eff === null && <span className="rounded-full border border-dashed px-2 py-0.5 text-[10px] sm:text-xs text-zinc-500 dark:border-zinc-700">○ Хариултгүй</span>}
                  </div>

                  {locked && eff !== null && (
                    <button
                      onClick={() => setRevealed((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                      className="mt-2 rounded-full border px-2.5 py-1 text-[11px] sm:text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      {isRevealed ? "Нуух" : "Зөв хариулт харах"}
                    </button>
                  )}

                  <div className="mt-2.5 sm:mt-3 grid gap-1.5 sm:gap-2">
                    {item.options.map((opt, i) => {
                      const isCorrect = eff !== null && i === eff;
                      const showCorrect = isRevealed && isCorrect;
                      return (
                        <div
                          key={i}
                          className={`rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-2.5 text-[13px] sm:text-sm flex gap-2 ${showCorrect ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white" : "border-zinc-200 dark:border-zinc-700"}`}
                        >
                          <span className={`flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold ${showCorrect ? "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>{LETTERS[i]}</span>
                          <span className="leading-snug">{opt}</span>
                          {showCorrect && <span className="ml-auto font-medium text-xs shrink-0">✓ Зөв</span>}
                        </div>
                      );
                    })}
                  </div>
                  {isRevealed && item.explanation && <p className="mt-2 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">Тайлбар: {item.explanation}</p>}

                  {!locked && (
                    <div className="mt-3 rounded-lg border border-dashed p-2.5 sm:p-3 dark:border-zinc-700">
                      <p className="text-[11px] sm:text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {eff === null
                          ? "Зөв хариулт тодорхойгүй — сонгоод хадгална уу:"
                          : `Таны хадгалсан: ${LETTERS[eff]} — солих:`}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {item.options.map((_, i) => {
                          const c = voteCounts[i] || 0;
                          return (
                            <button
                              key={i}
                              onClick={() => chooseAnswer(item.id, i)}
                              className={`rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-[12px] sm:text-sm border flex items-center gap-1 min-h-[34px] sm:min-h-[40px] ${eff === i ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}
                            >
                              <span className="font-bold">{LETTERS[i]}</span>
                              <span className={`text-[11px] ${eff === i ? "opacity-70" : "text-zinc-400"}`}>· {c}</span>
                            </button>
                          );
                        })}
                      </div>
                      {flash[item.id] && <p className="mt-1.5 text-[11px] sm:text-xs font-medium">{flash[item.id]}</p>}
                      {totalVotes > 0 && (
                        <p className="mt-1.5 text-[10px] sm:text-xs text-zinc-500">
                          Нийт {totalVotes} санал
                          {(() => {
                            let max = -1, maxIdx = -1;
                            voteCounts.forEach((v, i) => { if (v > max) { max = v; maxIdx = i; } });
                            return voteCounts.filter((v) => v === max).length === 1 && max > 0 ? ` · хамгийн их: ${LETTERS[maxIdx]} (${max})` : "";
                          })()}
                        </p>
                      )}
                      {mine && (
                        <button onClick={() => setPendingClear(item.id)} className="mt-1.5 text-[11px] sm:text-xs underline text-zinc-500">
                          Хадгалснаа арилгах
                        </button>
                      )}
                    </div>
                  )}

                  {!locked && <QuestionDiscussion questionId={item.id} />}

                  <div className="mt-2.5">
                    <QuestionReport questionId={item.id} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && <p className="text-center py-12 text-zinc-500 text-sm">Илэрц олдсонгүй.</p>}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 py-2 flex-wrap">
          <button disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-full border px-4 py-2 text-[12px] sm:text-sm disabled:opacity-40 dark:border-zinc-700 min-h-[36px]">←</button>
          {pageWindow.map((n, i, arr) => (
            <span key={n} className="flex items-center gap-1.5 sm:gap-2">
              {i > 0 && arr[i - 1] !== n - 1 && <span className="text-zinc-400 text-xs">…</span>}
              <button onClick={() => setPage(n)} className={`h-9 w-9 rounded-full text-[12px] sm:text-sm border ${n === safePage ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "dark:border-zinc-700"}`}>{n}</button>
            </span>
          ))}
          <button disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-full border px-4 py-2 text-[12px] sm:text-sm disabled:opacity-40 dark:border-zinc-700 min-h-[36px]">→</button>
        </div>
      )}

      {/* confirm save (normal mode) */}
      {pending && (() => {
        const pq = questions.find((x) => x.id === pending.id);
        if (!pq) return null;
        const curEff = effOf(pq);
        const isChange = curEff !== null && curEff !== pending.index;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setPending(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 dark:border dark:border-zinc-800">
              <h3 className="font-semibold">{isChange ? "Зөв хариултыг солих уу?" : "Зөв хариулт хадгалах уу?"}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">{pq.question}</p>
              <div className="mt-4 rounded-xl border bg-zinc-50 px-4 py-3 dark:bg-zinc-800 dark:border-zinc-700">
                <p className="text-sm"><span className="font-bold">{LETTERS[pending.index]}.</span> {pq.options[pending.index]}</p>
                {curEff !== null && <p className="mt-1 text-xs text-zinc-500">Одоогийн: {LETTERS[curEff]} · Шинэ: {LETTERS[pending.index]}</p>}
              </div>
              <p className="mt-3 text-xs text-zinc-500">Андуурч дарсан бол Цуцлах дарна уу — шууд хадгалагдахгүй.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setPending(null)} className="rounded-full border px-5 py-2 text-sm dark:border-zinc-700">Цуцлах</button>
                <button
                  autoFocus
                  onClick={async () => {
                    const { id, index } = pending;
                    await persistAnswer(id, index);
                    flashSaved(id, `✓ ${LETTERS[index]} хадгалагдлаа`);
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
                  autoFocus
                  onClick={async () => {
                    await persistAnswer(pendingClear as string, null);
                    setPendingClear(null);
                  }}
                  className="rounded-full bg-zinc-900 px-6 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
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
