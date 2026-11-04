"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { hasEditionAccess } from "@/lib/access";
import { EXAM_PLANS, getEdition, getPlan, LEGACY_EDITION_ID, type ExamPlan } from "@/lib/catalog";
import dynamic from "next/dynamic";

const PlanCheckoutContent = dynamic(() => import("@/components/PlanCheckoutContent"), { loading: () => <p role="status" className="p-12 text-center text-sm text-zinc-500">Ачааллаж байна…</p> });

const PlansContext = createContext<((planId?: string) => void) | null>(null);

// Links keep their real destination for new tabs and browsers without JavaScript.
export function PlanLink({ href, onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const open = useContext(PlansContext);
  return <a {...props} href={href} data-plan-modal="true" onClick={(event) => {
    onClick?.(event);
    if (!open || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === "_blank") return;
    if (href !== "/plans" && !href.startsWith("/plans/")) return;
    const planId = href.startsWith("/plans/") ? href.slice("/plans/".length) : undefined;
    if (planId && !getPlan(planId)) return;
    event.preventDefault();
    open(planId);
  }}>{children}</a>;
}

function Checkout({ plan, onPaid }: { plan: ExamPlan; onPaid: () => void }) {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const [result, setResult] = useState<{ authed: boolean; hasPaid: boolean; pending: boolean; freeCount: number | null } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const edition = getEdition(plan.editionId)!;

  useEffect(() => {
    if (status === "loading") return;
    const controller = new AbortController();
    async function load() {
      try {
        const [access, meta] = await Promise.all([
          userId ? fetch(`/api/payment-requests?planId=${encodeURIComponent(plan.id)}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
            if (response.status === 401) return { authed: false, hasPaid: false, request: null };
            if (!response.ok) throw new Error("Эрхийн мэдээлэл ачаалж чадсангүй.");
            return { ...await response.json(), authed: true };
          }) : Promise.resolve({ authed: false, hasPaid: false, request: null }),
          plan.editionId === LEGACY_EDITION_ID ? fetch("/api/questions?meta=1", { signal: controller.signal }).then((response) => response.ok ? response.json() : null).catch(() => null) : Promise.resolve(null),
        ]);
        if (controller.signal.aborted) return;
        const freeCount = meta?.mains?.filter((main: { name: string }) => edition.freeCategories.includes(main.name)).reduce((sum: number, main: { total: number }) => sum + main.total, 0) ?? null;
        setResult({ authed: access.authed, hasPaid: access.hasPaid, pending: access.request?.status === "PENDING", freeCount });
        setError("");
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Мэдээлэл ачаалж чадсангүй.");
      }
    }
    void load();
    return () => controller.abort();
  }, [plan.id, plan.editionId, edition.freeCategories, userId, status, retry]);

  if (error) return <div className="p-8 text-center"><p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p><button onClick={() => setRetry((n) => n + 1)} className="mt-4 min-h-11 rounded-full border border-zinc-300 px-5 text-sm dark:border-white/20">Дахин оролдох</button></div>;
  if (!result) return <p role="status" className="p-12 text-center text-sm text-zinc-500">Ачааллаж байна…</p>;
  return <PlanCheckoutContent key={`${plan.id}:${result.hasPaid}`} plan={plan} edition={edition} authed={result.authed} hasPaid={result.hasPaid} pendingRequest={result.pending} freeCount={result.freeCount} onPaid={() => { onPaid(); setRetry((n) => n + 1); }} />;
}

export default function PlansProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<{ planId?: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { data: session, update } = useSession();
  const user = session?.user as { role?: string; hasPaid?: boolean; editionIds?: string[] } | undefined;
  const open = useCallback((planId?: string) => setSelection({ planId }), []);
  const isOpen = selection !== null;
  const plan = selection?.planId ? getPlan(selection.planId) : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen, selection?.planId]);

  return <PlansContext.Provider value={open}>
    {children}
    <dialog ref={dialogRef} aria-labelledby="plans-modal-title" className="plans-dialog m-auto max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-5xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/60 dark:border-white/15 dark:bg-[#0c0c14] dark:text-zinc-100" onCancel={(event) => { if (event.target === event.currentTarget) setSelection(null); }} onClose={(event) => { if (event.target === event.currentTarget) setSelection(null); }} onClick={(event) => {
      if (event.target === event.currentTarget) setSelection(null);
      const anchor = (event.target as Element).closest("a[href]");
      if (anchor && !anchor.hasAttribute("data-plan-modal")) setSelection(null);
    }}>
      {selection && <>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#0c0c14]">
          <div className="flex items-center gap-3">{plan && <button aria-label="Бүх төлөвлөгөө" onClick={() => setSelection({})} className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 dark:border-white/15">←</button>}<h2 id="plans-modal-title" className="text-sm font-semibold">{plan ? getEdition(plan.editionId)!.title : "Төлөвлөгөө, үнэ"}</h2></div>
          <button ref={closeRef} autoFocus aria-label="Төлөвлөгөө хаах" onClick={() => setSelection(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/5">✕</button>
        </div>
        {plan ? <Checkout key={plan.id} plan={plan} onPaid={() => { void update(); }} /> : <div className="p-5 sm:p-8">
          <p className="max-w-2xl text-sm leading-7 text-zinc-500">Эрх бүр зөвхөн сонгосон шалгалт, оны хувилбарт үйлчилнэ. Бусад төрлийн шалгалт болон шинэ оны хувилбар тусдаа төлөвлөгөөтэй.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">{EXAM_PLANS.map((item) => {
            const edition = getEdition(item.editionId)!;
            const owned = hasEditionAccess(edition.id, user || {});
            return <article key={item.id} className="rounded-2xl border border-indigo-200 p-5 dark:border-indigo-400/25">
              <p className="text-sm text-zinc-500">{edition.examTitle}</p><h3 className="mt-2 text-xl font-bold">{item.title}</h3>
              <p className="mt-5 text-3xl font-extrabold">{item.price.toLocaleString("mn-MN")}₮</p><p className="mt-2 text-xs leading-5 text-zinc-500">Нэг удаагийн төлбөр · Энэ хувилбарт хугацаагүй</p>
              <ul className="mt-5 space-y-2 text-sm"><li>✓ {edition.year} оны бүх ангиллын асуулт</li><li>✓ Сорилго, сургалт, жишиг шалгалт</li><li>✓ Хадгалах, үргэлжлүүлэх</li></ul>
              <button onClick={() => setSelection({ planId: item.id })} className="mt-6 min-h-11 w-full rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500">{owned ? "✓ Эрхтэй · Дэлгэрэнгүй" : "Эрх авах →"}</button>
            </article>;
          })}</div>
        </div>}
      </>}
    </dialog>
  </PlansContext.Provider>;
}
