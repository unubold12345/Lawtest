"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Question } from "@/types/question";
import { indexMainName, indexSubName, type IndexData, type IndexRow, type QuestionPool } from "@/lib/questionIndex";
import { fetchQuestionsByIds } from "@/lib/fetchQuestionsByIds";
import { fileHasAnswer } from "@/lib/answerOverrides";
import { FREE_CATEGORY } from "@/lib/access";
import QuestionDiscussion from "@/components/QuestionDiscussion";
import QuestionNote from "@/components/QuestionNote";
import QuestionReport from "@/components/QuestionReport";
import DropSelect from "@/components/DropSelect";
import { scrollRoot } from "@/lib/scrollRoot";

const PAGE_SIZE = 20;
const LETTERS = ["A", "B", "C", "D", "E"];

type Status = "all" | "answered" | "unanswered" | "mine" | "noted";
type QTypeFilter = "all" | "case" | "knowledge";
type View = "list" | "card" | "grid";

// placeholder while the full question for a visible row is being fetched by id
function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-start gap-2">
        <span className="h-3 w-7 shrink-0 rounded bg-zinc-200/80 dark:bg-white/10" />
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="block h-3 w-11/12 rounded bg-zinc-200/80 dark:bg-white/10" />
          <span className="block h-2.5 w-1/3 rounded bg-zinc-200/60 dark:bg-white/[0.07]" />
        </span>
      </div>
    </div>
  );
}

export default function BrowseClient({ index, initialItems, pool }: { index: IndexData; initialItems?: Question[]; pool: QuestionPool }) {
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const isAuthed = !!session?.user;
  const fullAccess =
    (session?.user as unknown as { hasPaid?: boolean; role?: string } | undefined)?.hasPaid === true ||
    (session?.user as unknown as { role?: string } | undefined)?.role === "ADMIN";
  // saving answers is a paid feature
  const canSave = isAuthed && fullAccess;
  const searchRef = useRef<HTMLInputElement>(null);
  const viewsRef = useRef<HTMLDivElement>(null);

  const [q, setQ] = useState("");
  const [mainCategory, setMainCategory] = useState<string>(() => searchParams.get("cat") || "all");
  const [subCategory, setSubCategory] = useState<string>(() => searchParams.get("sub") || "all");
  const [status, setStatus] = useState<Status>("all");
  const [qtype, setQtype] = useState<QTypeFilter>(() => {
    const t = searchParams.get("type");
    return t === "case" || t === "knowledge" ? t : "all";
  });
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [myDb, setMyDb] = useState<Record<string, number>>({});
  const [notedIds, setNotedIds] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number[]>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ id: string; index: number } | null>(null);
  const [pendingClear, setPendingClear] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [gridCols, setGridCols] = useState<number>(2);
  const [cardIdx, setCardIdx] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [focusView, setFocusView] = useState(false);
  // full question objects are fetched lazily by id (index only carries ids + refs)
  const [items, setItems] = useState<Record<string, Question>>(() => {
    const m: Record<string, Question> = {};
    for (const q of initialItems ?? []) m[q.id] = q;
    return m;
  });
  const itemsRef = useRef<Record<string, Question>>(
    Object.fromEntries((initialItems ?? []).map((q) => [q.id, q]))
  );
  const [searchIds, setSearchIds] = useState<Set<string> | null>(null);
  const searchSeq = useRef(0);
  // paid categories are listed but their content is locked
  const paidCategorySelected = mainCategory !== "all" && mainCategory !== FREE_CATEGORY;
  const lockedMain = paidCategorySelected && !fullAccess;
  // session data is unknown until /api/auth/session resolves — don't flash
  // "locked" UI at paid users during that window
  const sessionPending = !session && sessionStatus === "loading";
  // this page's pool: the hasAnswer bit in the index row decides answered vs unanswered
  const poolRows = useMemo(() => {
    const want = pool === "answered" ? 1 : 0;
    return index.rows.filter((r) => r[3] === want);
  }, [index, pool]);
  // category counts restricted to this pool, so dropdown labels stay honest
  const poolMainCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of poolRows) {
      const n = indexMainName(index, r);
      if (n) m.set(n, (m.get(n) || 0) + 1);
    }
    return m;
  }, [index, poolRows]);
  const poolSubCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of poolRows) {
      const n = indexSubName(index, r);
      if (n) m.set(n, (m.get(n) || 0) + 1);
    }
    return m;
  }, [index, poolRows]);
  const poolFreeTotal = useMemo(() => poolRows.filter((r) => indexMainName(index, r) === FREE_CATEGORY).length, [index, poolRows]);
  const lockedCount = fullAccess ? 0 : poolRows.length - poolFreeTotal;

  const mergeItems = (list: Question[]) => {
    setItems((prev) => {
      const next = { ...prev };
      list.forEach((it) => {
        next[it.id] = it;
      });
      itemsRef.current = next;
      return next;
    });
  };

  // only categories that actually have questions in this pool (r[3] bit), so the
  // answered page never offers unanswered-only categories and vice versa
  const mainCategories = useMemo(
    () => index.mains.filter((m) => (poolMainCounts.get(m.name) ?? 0) > 0).map((m) => m.name),
    [index, poolMainCounts]
  );
  const subCategories = useMemo(() => {
    if (mainCategory !== "all") {
      const m = index.mains.find((x) => x.name === mainCategory);
      return m ? m.subs.filter((s) => (poolSubCounts.get(s.name) ?? 0) > 0).map((s) => s.name) : [];
    }
    return index.allSubs.filter((s) => (poolSubCounts.get(s.name) ?? 0) > 0).map((s) => s.name);
  }, [index, mainCategory, poolSubCounts]);
  const subCountFor = (name: string): number => poolSubCounts.get(name) ?? 0;

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

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!focusView) return;
    setFocusView(false);
    const el = viewsRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const root = scrollRoot();
    if (root && top < 0) root.scrollTo({ top: root.scrollTop + top, behavior: "instant" });
  }, [focusView]);

  // ---- answer state helpers ----
  const effOf = (item: Question): number | null => {
    if (fileHasAnswer(item)) {
      if (typeof item.answer === "number") return item.answer;
      if (Array.isArray(item.answer)) return (item.answer as number[])[0] ?? null;
      return null;
    }
    if (!isAuthed) return null;
    return typeof myDb[item.id] === "number" ? (myDb[item.id] as number) : null;
  };
  const mineOf = (item: Question): boolean => {
    if (fileHasAnswer(item)) return false;
    return isAuthed && typeof myDb[item.id] === "number";
  };
  const notedOf = (item: Question): boolean => isAuthed && notedIds.has(item.id);
  const statusOf = (item: Question): "answered" | "unanswered" | "mine" =>
    mineOf(item) ? "mine" : effOf(item) === null ? "unanswered" : "answered";

  // row-level helpers (index rows): [id, mainIdx, subIdx, hasAnswer, isCase]
  const statusOfRow = (r: IndexRow): "answered" | "unanswered" | "mine" =>
    r[3] === 1 ? "answered" : isAuthed && typeof myDb[r[0]] === "number" ? "mine" : "unanswered";
  const notedOfRow = (r: IndexRow): boolean => isAuthed && notedIds.has(r[0]);

  const filteredNoType = useMemo(() => {
    let out = poolRows;
    if (mainCategory !== "all") {
      const mi = index.mains.findIndex((m) => m.name === mainCategory);
      out = out.filter((r) => r[1] === mi);
    }
    if (subCategory !== "all") out = out.filter((r) => indexSubName(index, r) === subCategory);
    if (!fullAccess) out = out.filter((r) => indexMainName(index, r) === FREE_CATEGORY);
    if (searchIds) out = out.filter((r) => searchIds.has(r[0]));
    return out;
  }, [poolRows, index, mainCategory, subCategory, fullAccess, searchIds]);

  const typeCounts = useMemo(() => {
    let c = 0;
    filteredNoType.forEach((r) => { if (r[4] === 1) c++; });
    return { case: c, knowledge: filteredNoType.length - c };
  }, [filteredNoType]);

  const filteredBase = useMemo(
    () => (qtype === "all" ? filteredNoType : filteredNoType.filter((r) => (r[4] === 1) === (qtype === "case"))),
    [filteredNoType, qtype]
  );

  const statusCounts = useMemo(() => {
    let answered = 0, unanswered = 0, mine = 0, noted = 0;
    filteredBase.forEach((r) => {
      const s = statusOfRow(r);
      if (s === "mine") mine++;
      else if (s === "answered") answered++;
      else unanswered++;
      if (notedOfRow(r)) noted++;
    });
    return { answered, unanswered, mine, noted, total: filteredBase.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredBase, myDb, notedIds, isAuthed]);

  const filtered = useMemo(() => {
    if (status === "all") return filteredBase;
    if (status === "noted") return filteredBase.filter((r) => notedOfRow(r));
    return filteredBase.filter((r) => statusOfRow(r) === status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredBase, status, myDb, notedIds, isAuthed]);

  const readyPct = statusCounts.total === 0 ? 0 : Math.round(((statusCounts.answered + statusCounts.mine) / statusCounts.total) * 100);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pagedIds = pagedRows.map((r) => r[0]);

  // card view: single question with prev/next across the whole filtered list
  const safeCardIdx = filtered.length === 0 ? 0 : Math.min(Math.max(0, cardIdx), filtered.length - 1);
  const cardRow = filtered.length === 0 ? undefined : filtered[safeCardIdx];
  const cardItem: Question | undefined = cardRow ? items[cardRow[0]] : undefined;
  const goCard = (dir: number) => {
    if (filtered.length === 0) return;
    setCardIdx((i) => (i + dir + filtered.length) % filtered.length);
  };
  const gridColsClass =
    gridCols === 1 ? "grid-cols-1"
    : gridCols === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    : gridCols === 4 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
    : "grid-cols-1 sm:grid-cols-2";
  const phoneTiles = view === "grid" && isPhone && gridCols >= 2;
  const tileColsClass = gridCols === 4 ? "grid-cols-4" : gridCols === 3 ? "grid-cols-3" : "grid-cols-2";
  const gridDenseClass = !phoneTiles && gridCols >= 2 ? "grid-flow-row-dense" : "";
  // grid ≥2 cols: accordion — expanding one question collapses the previous one (otherwise wide cards stack up and jump rows)
  const gridAccordion = !phoneTiles && view === "grid" && gridCols >= 2;
  // list view too: opening a question minimizes the one that was open (the user reads one at a time)
  const accordion = gridAccordion || view === "list";

  // fetch all my saved answers once — paged fetch alone deadlocks the ✓ Минийх filter (empty page → no fetch → stays empty)
  useEffect(() => {
    if (!isAuthed) { setMyDb({}); return; }
    let cancelled = false;
    fetch("/api/saved-answers?mine=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.my) setMyDb((p) => ({ ...d.my, ...p })); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthed]);

  // fetch vote counts for saveable visible rows (public, my vote if authed)
  useEffect(() => {
    const visible = view === "card" ? (cardRow ? [cardRow] : []) : pagedRows;
    const ids = visible.filter((r) => r[3] === 0).map((r) => r[0]);
    if (ids.length === 0) return;
    fetch(`/api/saved-answers?ids=${encodeURIComponent(ids.join(","))}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.counts) setCounts((prev) => ({ ...prev, ...d.counts }));
        if (d.my) setMyDb((prev) => ({ ...prev, ...d.my }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagedIds.join(","), view, cardRow?.[0]]);

  // fetch full questions for the visible page (and the card item) by id
  const needIdsKey = [...new Set([...pagedIds, ...(view === "card" && cardRow ? [cardRow[0]] : [])])].join(",");
  useEffect(() => {
    const missing = needIdsKey ? needIdsKey.split(",").filter((id) => id && !itemsRef.current[id]) : [];
    if (missing.length === 0) return;
    let cancelled = false;
    fetchQuestionsByIds(missing)
      .then((list) => {
        if (!cancelled && list.length) mergeItems(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needIdsKey]);

  // text search runs server-side against the light index (question/options/category/subcategory)
  useEffect(() => {
    const s = q.trim();
    if (!s) { setSearchIds(null); return; }
    const seq = ++searchSeq.current;
    const t = window.setTimeout(() => {
      fetch(`/api/questions?filter=1&q=${encodeURIComponent(s)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (seq !== searchSeq.current) return;
          if (Array.isArray(d?.ids)) setSearchIds(new Set(d.ids as string[]));
        })
        .catch(() => {});
    }, 200);
    return () => window.clearTimeout(t);
  }, [q]);

  // fetch all my noted question ids once (for the Тэмдэглэлтэй filter + badges)
  useEffect(() => {
    if (!isAuthed) { setNotedIds(new Set()); return; }
    fetch("/api/notes")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.ids)) setNotedIds(new Set(d.ids as string[])); })
      .catch(() => {});
  }, [isAuthed]);

  // card view: expand the incoming question during render (pre-commit) — expanding it
  // in an effect left the first committed frame collapsed, so the page height dropped,
  // the browser clamped scroll toward the top and the position was lost (card root is
  // keyed by item.id, so each swap remounts)
  const [prevCardId, setPrevCardId] = useState<string | null>(null);
  if (view === "card" && cardItem && cardItem.id !== prevCardId) {
    setPrevCardId(cardItem.id);
    setExpanded((p) => (p[cardItem.id] ? p : { ...p, [cardItem.id]: true }));
    setActiveId(cardItem.id);
  }

  const onSearch = (v: string) => { setQ(v); setPage(1); setCardIdx(0); };
  const onMain = (v: string) => { setMainCategory(v); setSubCategory("all"); setPage(1); setCardIdx(0); };
  const onSub = (v: string) => { setSubCategory(v); setPage(1); setCardIdx(0); };
  const onStatus = (v: Status) => { setStatus(v); setPage(1); setCardIdx(0); };
  const onQtype = (v: "case" | "knowledge") => { setQtype((p) => (p === v ? "all" : v)); setPage(1); setCardIdx(0); };

  // ---- saving ----
  const persistAnswer = async (id: string, index: number | null) => {
    if (!canSave) return;
    try {
      const r = await fetch("/api/saved-answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: id, answer: index }) });
      if (r.ok) {
        if (index === null) {
          setMyDb((prev) => { const n = { ...prev }; delete n[id]; return n; });
        } else {
          setMyDb((prev) => ({ ...prev, [id]: index }));
        }
        fetch(`/api/saved-answers?ids=${encodeURIComponent(id)}`).then((rr) => rr.json()).then((d) => { if (d.counts) setCounts((p) => ({ ...p, ...d.counts })); }).catch(() => {});
      }
    } catch { /* ignore */ }
  };

  const flashSaved = (id: string, text: string) => {
    setFlash((p) => ({ ...p, [id]: text }));
    window.setTimeout(() => setFlash((p) => { const n = { ...p }; delete n[id]; return n; }), 2600);
  };

  const chooseAnswer = (id: string, index: number) => {
    if (!canSave) return;
    setPending({ id, index });
  };

  const toggleExpand = (id: string) => {
    if (accordion) setExpanded((p) => (p[id] ? {} : { [id]: true }));
    else setExpanded((p) => ({ ...p, [id]: !p[id] }));
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
      if (view === "card") {
        if (e.key === "ArrowRight" || e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
          e.preventDefault();
          goCard(1);
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
          e.preventDefault();
          goCard(-1);
          return;
        }
        return;
      }
      if (pagedRows.length === 0) return;
      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        const at = pagedRows.findIndex((r) => r[0] === activeId);
        const nxtId = pagedRows[(at + 1 + pagedRows.length) % pagedRows.length][0];
        setExpanded((p) => (accordion ? { [nxtId]: true } : { ...p, [nxtId]: true }));
        setActiveId(nxtId);
        requestAnimationFrame(() => document.getElementById(`qrow-${nxtId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
        return;
      }
      if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        const at = pagedRows.findIndex((r) => r[0] === activeId);
        const prvId = pagedRows[(at - 1 + pagedRows.length) % pagedRows.length][0];
        setExpanded((p) => (accordion ? { [prvId]: true } : { ...p, [prvId]: true }));
        setActiveId(prvId);
        requestAnimationFrame(() => document.getElementById(`qrow-${prvId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
        return;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, pagedRows, myDb, isAuthed, pending, pendingClear, view, filtered, gridCols, isPhone]);

  // entering accordion mode (list view, grid ≥2 cols): keep at most one card open
  useEffect(() => {
    if (!accordion) return;
    setExpanded((p) => {
      const open = Object.keys(p).filter((k) => p[k]);
      if (open.length <= 1) return p;
      const keep = activeId && p[activeId] ? activeId : open[open.length - 1];
      return { [keep]: true };
    });
  }, [accordion, activeId]);

  // quiz link preserves current view (prep flow)
  const quizHref = (() => {
    const sp = new URLSearchParams();
    if (mainCategory !== "all") sp.set("main", mainCategory);
    if (subCategory !== "all") sp.set("sub", subCategory);
    if (q.trim()) sp.set("q", q.trim());
    if (qtype !== "all") sp.set("type", qtype);
    const s = sp.toString();
    return s ? `/quiz?${s}` : "/quiz";
  })();

  const pageWindow = useMemo(() => {
    const win = new Set<number>([1, totalPages, safePage - 1, safePage, safePage + 1]);
    return [...win].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  }, [safePage, totalPages]);

  // answered/unanswered are separate pages now — only the remaining status pills live here
  const statusPills: { id: Status; label: string; n: number }[] = [
    { id: "all", label: "Бүгд", n: statusCounts.total },
    ...(pool === "unanswered" ? [{ id: "mine" as Status, label: "✓ Минийх", n: statusCounts.mine }] : []),
    ...(isAuthed ? [{ id: "noted" as Status, label: "✎ Тэмдэглэлтэй", n: statusCounts.noted }] : []),
  ];

  // ---- single question card shared by list / card / grid views ----
  const renderItem = (item: Question, globalIdx: number) => {
    const locked = fileHasAnswer(item);
    const eff = effOf(item);
    const mine = mineOf(item);
    const st = statusOf(item);
    const isOpen = !!expanded[item.id];
    const isActive = activeId === item.id;
    const isRevealed = !!revealed[item.id];
    const pick = picked[item.id];
    const voteCounts: number[] = counts[item.id] || [];
    const totalVotes = voteCounts.reduce((a, b) => a + b, 0);
    const mark = st === "mine" ? "✓" : st === "answered" ? "●" : "○";
    // grid view (desktop, 2+ columns): the expanded question spans the full row,
    // other tiles repack around it via grid-auto-flow: dense
    const gridSpan =
      view === "grid" && !phoneTiles && gridCols >= 2 && isOpen
        ? gridCols === 2
          ? "sm:col-span-2"
          : gridCols === 3
            ? "sm:col-span-2 lg:col-span-3"
            : "sm:col-span-2 lg:col-span-4"
        : "";
    return (
      <div key={item.id} id={`qrow-${item.id}`} className={`rounded-xl border bg-white dark:bg-white/[0.04] scroll-mt-20 ${gridSpan} ${isActive ? "border-indigo-500 dark:border-indigo-400/60" : "border-zinc-200 dark:border-white/10"}`}>
        <button onClick={() => toggleExpand(item.id)} aria-expanded={isOpen} className="flex w-full items-start gap-2 px-3 py-2.5 sm:px-4 sm:py-3 text-left">
          <span className="shrink-0 text-[11px] sm:text-xs text-zinc-400 w-7 pt-0.5">{globalIdx}.</span>
          <span className={`shrink-0 pt-0.5 text-[13px] sm:text-sm ${st === "unanswered" ? "text-zinc-300 dark:text-zinc-600" : st === "mine" ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-600 dark:text-indigo-300"} ${st === "mine" ? "font-bold" : ""}`}>{mark}</span>
          <span className="min-w-0 flex-1">
            <span className={`block leading-snug break-words ${isOpen ? "text-[13px] sm:text-[15px] font-medium" : "text-[12px] sm:text-sm line-clamp-2"}`}>{item.question}</span>
            <span className="mt-0.5 block truncate text-[10px] sm:text-[11px] text-zinc-400">{item.category}{item.subCategory ? ` · ${item.subCategory}` : ""}{!locked && eff !== null ? ` · ${LETTERS[eff]}` : ""}{!locked && notedIds.has(item.id) ? " · ✎" : ""}</span>
          </span>
          <span className="shrink-0 pt-1 text-[10px] text-zinc-400">{isOpen ? "▴" : "▾"}</span>
        </button>

        {isOpen && (
          <div className="border-t px-3 py-3 sm:px-4 sm:py-4 dark:border-white/10">
            <div className="flex gap-1 flex-wrap">
              {item.category && <span className="rounded-full bg-indigo-50 text-indigo-600 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs dark:bg-indigo-500/10 dark:text-indigo-300">{item.category}</span>}
              {item.subCategory && <span className="rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs dark:bg-white/5 dark:text-zinc-300">{item.subCategory}</span>}
              {!locked && mine && <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] sm:text-xs dark:bg-emerald-400/10 dark:text-emerald-400">✓ Та хадгалсан</span>}
              {!locked && eff === null && <span className="rounded-full border border-dashed border-zinc-200 px-2 py-0.5 text-[10px] sm:text-xs text-zinc-500 dark:border-white/15">○ Хариултгүй</span>}
            </div>

            {locked && eff !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setRevealed((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] sm:text-xs font-medium hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5"
                >
                  {isRevealed ? "Нуух" : "Зөв хариулт харах"}
                </button>
                {pick === undefined && !isRevealed && (
                  <span className="text-[11px] sm:text-xs text-zinc-400">Сонголт дээр дарж шалгах боломжтой</span>
                )}
              </div>
            )}

            <div className="mt-2.5 sm:mt-3 grid gap-1.5 sm:gap-2">
              {item.options.map((opt, i) => {
                const isCorrect = eff !== null && i === eff;
                const answered = locked && eff !== null && pick !== undefined;
                const showCorrect = (isRevealed || answered) && isCorrect;
                const showWrong = answered && pick === i && !isCorrect;
                const tone = showCorrect
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100"
                  : showWrong
                    ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-100"
                    : "border-zinc-200 dark:border-white/10";
                const pillTone = showCorrect
                  ? "bg-emerald-600 text-white dark:bg-emerald-500/30 dark:text-emerald-100"
                  : showWrong
                    ? "bg-rose-600 text-white dark:bg-rose-500/30 dark:text-rose-100"
                    : "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300";
                const rowCls = `rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-2.5 text-[13px] sm:text-sm flex gap-2 ${tone}`;
                const rowBody = (
                  <>
                    <span className={`flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold ${pillTone}`}>{LETTERS[i]}</span>
                    <span className="leading-snug">{opt}</span>
                    {showCorrect && <span className="ml-auto font-medium text-xs shrink-0">✓ Зөв</span>}
                    {showWrong && <span className="ml-auto font-medium text-xs shrink-0">✗ Буруу</span>}
                  </>
                );
                if (locked && eff !== null) {
                  return (
                    <button
                      type="button"
                      key={i}
                      aria-pressed={pick === i}
                      onClick={() =>
                        setPicked((prev) => {
                          const next = { ...prev };
                          if (next[item.id] === i) delete next[item.id];
                          else next[item.id] = i;
                          return next;
                        })
                      }
                      className={`${rowCls} w-full text-left hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/5`}
                    >
                      {rowBody}
                    </button>
                  );
                }
                return (
                  <div key={i} className={rowCls}>
                    {rowBody}
                  </div>
                );
              })}
            </div>
            {(isRevealed || pick !== undefined) && item.explanation && <p className="mt-2 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">Тайлбар: {item.explanation}</p>}

            {!locked && !isAuthed && (
              <div className="mt-3 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/60 p-2.5 sm:p-3 text-[11px] sm:text-xs text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200">
                Зөв хариулт хадгалахын тулд <Link href="/login" className="font-medium text-zinc-900 underline hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300">нэвтэрнэ үү</Link>.
              </div>
            )}

            {!locked && isAuthed && !fullAccess && (
              <div className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-2.5 sm:p-3 text-[11px] sm:text-xs text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                Зөв хариулт хадгалах нь төлбөртэй — <Link href="/plan" className="font-medium text-zinc-900 underline hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300">Эрх авах</Link>.
              </div>
            )}

            {!locked && canSave && (
              <div className="mt-3 rounded-lg border border-dashed border-zinc-200 p-2.5 sm:p-3 dark:border-white/10">
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
                        className={`rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-[12px] sm:text-sm border flex items-center gap-1 min-h-[34px] sm:min-h-[40px] ${eff === i ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5"}`}
                      >
                        <span className="font-bold">{LETTERS[i]}</span>
                        <span className={`text-[11px] ${eff === i ? "opacity-70" : "text-zinc-400"}`}>· {c}</span>
                      </button>
                    );
                  })}
                </div>
                {flash[item.id] && <p className="mt-1.5 text-[11px] sm:text-xs font-medium text-emerald-600 dark:text-emerald-400">{flash[item.id]}</p>}
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
                  <button onClick={() => setPendingClear(item.id)} className="mt-1.5 text-[11px] sm:text-xs underline text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400">
                    Хадгалснаа арилгах
                  </button>
                )}
              </div>
            )}

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {!locked && <QuestionDiscussion questionId={item.id} />}
              <QuestionNote
                questionId={item.id}
                initialHas={notedIds.has(item.id)}
                onChange={(id, has) => setNotedIds((prev) => { const n = new Set(prev); if (has) n.add(id); else n.delete(id); return n; })}
              />
              <QuestionReport questionId={item.id} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4 px-3 sm:px-0">
      {/* controls (collapsible) */}
      <div className="rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <button
          onClick={() => setControlsOpen((o) => !o)}
          aria-expanded={controlsOpen}
          className="flex min-h-[36px] w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex min-w-0 items-center gap-2 text-[12px] sm:text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            Шүүлтүүр
            {!controlsOpen && (
              <span className="truncate text-[11px] sm:text-xs font-normal text-zinc-500">
                · {filtered.length} илэрц{q.trim() ? ` · «${q.trim()}»` : ""}{mainCategory !== "all" ? ` · ${mainCategory}` : ""}{subCategory !== "all" ? ` · ${subCategory}` : ""}{qtype !== "all" ? ` · ${qtype === "case" ? "Кейс" : "Онол"}` : ""}
              </span>
            )}
          </span>
          <span className="shrink-0 text-zinc-500" aria-hidden>{controlsOpen ? "▾" : "▸"}</span>
        </button>
        {controlsOpen && (
        <div className="space-y-2 sm:space-y-3 pt-2">
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Хайх... сорилго эсвэл хариулт"
          className="w-full rounded-full border border-zinc-200 px-3 py-2 sm:px-4 sm:py-2 text-[13px] sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60"
        />
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          <DropSelect
            value={mainCategory}
            onChange={onMain}
            ariaLabel="Үндсэн ангилал"
            buttonClassName="rounded-lg sm:rounded-full border border-zinc-200 px-2 py-2 sm:px-4 sm:py-2 text-[12px] sm:text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 min-h-[36px] sm:min-h-[44px]"
            options={[
              { value: "all", label: `Бүх үндсэн (${poolRows.length})` },
              ...mainCategories.map((c) => ({ value: c, label: `${c} (${poolMainCounts.get(c) ?? 0})` })),
            ]}
          />
          <DropSelect
            value={subCategory}
            onChange={onSub}
            ariaLabel="Дэд ангилал"
            buttonClassName="rounded-lg sm:rounded-full border border-zinc-200 px-2 py-2 sm:px-4 sm:py-2 text-[12px] sm:text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 min-h-[36px] sm:min-h-[44px]"
            disabled={mainCategory === "all" && subCategories.length === 0}
            options={[
              { value: "all", label: `Бүх дэд (${filteredBase.length})` },
              ...subCategories.map((c) => ({ value: c, label: `${c} (${subCountFor(c)})` })),
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] sm:text-xs text-zinc-500">Төрөл:</span>
          {([
            { id: "case" as const, label: "Кейс", n: typeCounts.case, hint: "Нөхцөл байдалд дүгнэлт хийх — сэтгэн бодох чадвар" },
            { id: "knowledge" as const, label: "Онол", n: typeCounts.knowledge, hint: "Онолын мэдлэг шалгах — шууд эргэн санах" },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => onQtype(t.id)}
              aria-pressed={qtype === t.id}
              title={t.hint}
              className={`rounded-full border px-3 py-1.5 text-[11px] sm:text-xs font-medium min-h-[32px] sm:min-h-[36px] ${qtype === t.id ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"}`}
            >
              {t.label} · {t.n}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {statusPills.map((p) => (
            <button
              key={p.id}
              onClick={() => onStatus(p.id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] sm:text-xs font-medium min-h-[32px] sm:min-h-[36px] ${status === p.id ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : `border-zinc-200 hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5 ${p.id === "mine" ? "text-emerald-600 dark:text-emerald-400" : p.id === "noted" ? "text-violet-600 dark:text-violet-300" : p.id === "answered" ? "text-indigo-600 dark:text-indigo-300" : p.id === "unanswered" ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-700 dark:text-zinc-300"}`}`}
            >
              {p.label} · {p.n}
            </button>
          ))}
        </div>
        </div>
        )}
      </div>

      {!lockedMain && !sessionPending && lockedCount > 0 && (
        <div className="rounded-xl sm:rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-3 sm:p-4 dark:border-amber-400/30 dark:bg-amber-400/10 flex flex-col sm:flex-row sm:items-center gap-2">
          <p className="flex-1 text-[12px] sm:text-sm text-amber-700 dark:text-amber-300 line-clamp-2">
            🔒 {lockedCount} сорилго түгжээтэй — бусад бүх ангилал төлбөртэй.
          </p>
          <Link href="/plan" className="shrink-0 inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-[12px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[36px]">
            Эрх авах →
          </Link>
        </div>
      )}

      {/* readiness + practice */}
      {lockedMain ? (
        sessionPending ? null : (
        <div className="rounded-xl sm:rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8 text-center dark:border-amber-400/30 dark:bg-amber-400/10">
          <p className="text-3xl">🔒</p>
          <h2 className="mt-2 font-semibold text-[15px] sm:text-lg">Төлбөртэй ангилал</h2>
          <p className="mt-1 text-[12px] sm:text-sm text-amber-700 dark:text-amber-300">
            «{mainCategory}» ангиллын сорилго үзэх, шалгалт өгөх нь <b>Эрх авах</b> төлөвлөгөөнд багтдаг. Үнэгүй: {FREE_CATEGORY}.
          </p>
          <Link href="/plan" className="mt-4 inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-2.5 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px]">
            Эрх авах — 39,900₮ →
          </Link>
        </div>
        )
      ) : (
      <div className="rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] sm:text-sm font-medium">Шалгалтад бэлэн: {readyPct}%</p>
          <p className="text-[11px] sm:text-xs text-zinc-500">{statusCounts.answered + statusCounts.mine}/{statusCounts.total} хариулттай</p>
        </div>
        <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-zinc-900 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 transition-all" style={{ width: `${readyPct}%` }} />
        </div>
        <Link
          href={quizHref}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-[13px] sm:text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[40px] sm:min-h-[44px]"
        >
          Энэ шүүлтүүрээр шалгалт өгөх → <span className="opacity-70">({filteredBase.length})</span>
        </Link>
      </div>
      )}

      {/* view switcher — above the list */}
      {!lockedMain && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-full border border-zinc-200 bg-zinc-50 p-0.5 dark:border-white/15 dark:bg-white/5" role="group" aria-label="Харагдац">
            {([{ v: "list", label: "Жагсаалт" }, { v: "card", label: "Карт" }, { v: "grid", label: "Сүлжээ" }] as { v: View; label: string }[]).map((o) => (
              <button
                key={o.v}
                onClick={() => setView(o.v)}
                aria-label={o.label}
                aria-pressed={view === o.v}
                title={o.label}
                className={`inline-flex h-8 w-11 items-center justify-center rounded-full transition-colors ${view === o.v ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-500 hover:bg-white hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"}`}
              >
                {o.v === "list" ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : o.v === "card" ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
                    <path d="M7.5 9.5h7M7.5 13.5h4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
                    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
                    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
                    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          {view === "grid" && (
            <span className="ml-1 flex items-center gap-1">
              <span className="text-[11px] sm:text-xs text-zinc-500">Багана:</span>
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setGridCols(n)}
                  aria-label={`${n} багана`}
                  className={`h-8 w-8 rounded-full border text-[12px] sm:text-sm font-medium ${gridCols === n ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"}`}
                >
                  {n}
                </button>
              ))}
            </span>
          )}
        </div>
      )}

      {/* views: list / card / grid */}
      {!lockedMain && view === "list" && (
      <div className="grid gap-1.5 sm:gap-2">
        {pagedRows.map((row, idx) => {
          const item = items[row[0]];
          const n = (safePage - 1) * PAGE_SIZE + idx + 1;
          return item ? renderItem(item, n) : <SkeletonRow key={row[0]} />;
        })}
      </div>
      )}

      {!lockedMain && view === "card" && (
      <div ref={viewsRef} className="space-y-2">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-2 py-2 dark:border-white/10 dark:bg-white/[0.04]">
          <button onClick={() => goCard(-1)} disabled={filtered.length <= 1} className="rounded-full border border-zinc-200 px-4 py-2 text-[12px] sm:text-sm disabled:opacity-40 hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5 min-h-[36px]">← Өмнөх</button>
          <span className="text-[11px] sm:text-xs text-zinc-500">{filtered.length === 0 ? "0 / 0" : `${safeCardIdx + 1} / ${filtered.length}`}</span>
          <button onClick={() => goCard(1)} disabled={filtered.length <= 1} className="rounded-full border border-zinc-200 px-4 py-2 text-[12px] sm:text-sm disabled:opacity-40 hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5 min-h-[36px]">Дараах →</button>
        </div>
        {cardItem ? renderItem(cardItem, safeCardIdx + 1) : filtered.length > 0 ? <SkeletonRow /> : <p className="text-center py-12 text-zinc-500 text-sm">Илэрц олдсонгүй.</p>}
      </div>
      )}

      {!lockedMain && view === "grid" && (
      <div ref={viewsRef} className={`grid gap-1.5 sm:gap-2 ${phoneTiles ? tileColsClass : `${gridColsClass} ${gridDenseClass}`}`}>
        {phoneTiles
          ? pagedRows.map((row, idx) => {
              const n = (safePage - 1) * PAGE_SIZE + idx + 1;
              const item = items[row[0]];
              const dot = row[3] === 0 && isAuthed && typeof myDb[row[0]] === "number" ? "bg-emerald-500" : notedOfRow(row) ? "bg-violet-500" : "";
              const clamp = gridCols === 2 ? "line-clamp-2" : gridCols === 3 ? "line-clamp-1" : "";
              const narrow = gridCols === 4;
              return (
                <button
                  key={row[0]}
                  type="button"
                  onClick={() => { setView("card"); setCardIdx(n - 1); setFocusView(true); }}
                  aria-label={`Асуулт ${n} — карт харах`}
                  className={`relative flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-2 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/10 ${narrow ? "h-14 items-center justify-center" : "min-h-[64px] items-stretch text-left"}`}
                >
                  <span className={`font-semibold leading-none text-zinc-800 dark:text-zinc-200 ${narrow ? "text-[15px]" : "text-[13px]"}`}>{n}</span>
                  {clamp && item && <span className={`break-words text-[10px] leading-tight text-zinc-500 dark:text-zinc-400 ${clamp}`}>{item.question}</span>}
                  {dot && <span className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${dot}`} />}
                </button>
              );
            })
          : pagedRows.map((row, idx) => {
              const item = items[row[0]];
              const n = (safePage - 1) * PAGE_SIZE + idx + 1;
              return item ? renderItem(item, n) : <SkeletonRow key={row[0]} />;
            })}
      </div>
      )}

      {!lockedMain && view !== "card" && filtered.length === 0 && <p className="text-center py-12 text-zinc-500 text-sm">Илэрц олдсонгүй.</p>}

      {!lockedMain && view !== "card" && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 py-2 flex-wrap">
          <button disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-full border border-zinc-200 px-4 py-2 text-[12px] sm:text-sm disabled:opacity-40 hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5 min-h-[36px]">←</button>
          {pageWindow.map((n, i, arr) => (
            <span key={n} className="flex items-center gap-1.5 sm:gap-2">
              {i > 0 && arr[i - 1] !== n - 1 && <span className="text-zinc-400 text-xs">…</span>}
              <button onClick={() => setPage(n)} className={`h-9 w-9 rounded-full text-[12px] sm:text-sm border ${n === safePage ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25" : "border-zinc-200 hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5"}`}>{n}</button>
            </span>
          ))}
          <button disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-full border border-zinc-200 px-4 py-2 text-[12px] sm:text-sm disabled:opacity-40 hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5 min-h-[36px]">→</button>
        </div>
      )}

      {/* confirm save (normal mode) */}
      {pending && (() => {
        const pq = items[pending.id];
        if (!pq) return null;
        const curEff = effOf(pq);
        const isChange = curEff !== null && curEff !== pending.index;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setPending(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60" />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-white/10 dark:bg-[#0c0c14]/95 dark:backdrop-blur-xl">
              <h3 className="font-semibold">{isChange ? "Зөв хариултыг солих уу?" : "Зөв хариулт хадгалах уу?"}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">{pq.question}</p>
              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-sm"><span className="font-bold">{LETTERS[pending.index]}.</span> {pq.options[pending.index]}</p>
                {curEff !== null && <p className="mt-1 text-xs text-zinc-500">Одоогийн: {LETTERS[curEff]} · Шинэ: {LETTERS[pending.index]}</p>}
              </div>
              <p className="mt-3 text-xs text-zinc-500">Андуурч дарсан бол Цуцлах дарна уу — шууд хадгалагдахгүй.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setPending(null)} className="rounded-full border border-zinc-200 px-5 py-2 text-sm hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5">Цуцлах</button>
                <button
                  autoFocus
                  onClick={async () => {
                    const { id, index } = pending;
                    await persistAnswer(id, index);
                    flashSaved(id, `✓ ${LETTERS[index]} хадгалагдлаа`);
                    setPending(null);
                  }}
                  className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400"
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
        const pq = items[pendingClear];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button aria-label="close" onClick={() => setPendingClear(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60" />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-white/10 dark:bg-[#0c0c14]/95 dark:backdrop-blur-xl">
              <h3 className="font-semibold">Хадгалсан хариултыг арилгах уу?</h3>
              {pq && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">{pq.question}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setPendingClear(null)} className="rounded-full border border-zinc-200 px-5 py-2 text-sm hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5">Цуцлах</button>
                <button
                  autoFocus
                  onClick={async () => {
                    await persistAnswer(pendingClear as string, null);
                    setPendingClear(null);
                  }}
                  className="rounded-full bg-rose-600 px-6 py-2 text-sm font-medium text-white shadow-sm shadow-rose-600/30 hover:bg-rose-500 dark:bg-gradient-to-r dark:from-rose-500 dark:to-rose-600 dark:text-white dark:shadow-lg dark:shadow-rose-950/40 dark:hover:from-rose-400 dark:hover:to-rose-500"
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
