"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type DropOption = { value: string; label: string; green?: boolean; group?: string; triggerLabel?: string };

// Custom dropdown modeled on the quiz setup "Дэд ангилал сонгох…" picker:
// the panel is clipped to the trigger width (absolute left-0 right-0) with
// truncated options, so long category names can never overflow the card the
// way a native <select> open list does on Windows Chrome.
// On phones (max-width 639px) `sheetOnMobile` swaps the cramped in-place panel
// for a bottom sheet: full-width 48px rows, search for long lists, safe-area
// padding and a portal so sticky/backdrop-blur ancestors can't trap it.
export default function DropSelect({
  value,
  onChange,
  options,
  buttonClassName,
  disabled,
  ariaLabel,
  sheetOnMobile,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropOption[];
  buttonClassName: string;
  disabled?: boolean;
  ariaLabel?: string;
  sheetOnMobile?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [query, setQuery] = useState("");
  const current = options.find((o) => o.value === value);
  const panelRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const sheetMode = !!sheetOnMobile && isMobile;

  // When the panel opens, jump straight to the current selection (e.g. 1.30)
  // instead of starting at the top — manual scrollTop so the page never moves.
  useEffect(() => {
    if (!open || sheetMode) return;
    const panel = panelRef.current;
    if (!panel) return;
    const sel = panel.querySelector<HTMLElement>("[data-current='true']");
    if (sel) panel.scrollTop = Math.max(0, sel.offsetTop - panel.clientHeight / 2 + sel.clientHeight / 2);
  }, [open, sheetMode]);

  useEffect(() => {
    if (!open || !sheetMode) return;
    sheetRef.current?.focus({ preventScroll: true });
    const list = sheetListRef.current;
    if (list) {
      const sel = list.querySelector<HTMLElement>("[data-current='true']");
      if (sel) list.scrollTop = Math.max(0, sel.offsetTop - list.clientHeight / 2 + sel.clientHeight / 2);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sheetMode]);

  const shown = query.trim()
    ? options.filter((o) => `${o.group ?? ""} ${o.label}`.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div className="relative w-full min-w-0">
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => { setQuery(""); setOpen((v) => !v); }}
        className={`flex w-full max-w-full min-w-0 items-center justify-between gap-2 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        <span className={`truncate text-left ${current?.green ? "font-medium text-emerald-600 dark:text-emerald-400" : ""}`}>
          {current?.green && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" aria-hidden />}
          {current ? (current.triggerLabel ?? current.label) : (placeholder ?? "")}
        </span>
        <span className="shrink-0 text-xs text-zinc-400">{open ? "▴" : "▾"}</span>
      </button>

      {open && !disabled && !sheetMode && (
        <>
          <button aria-label="close" onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default bg-transparent" />
          <div ref={panelRef} className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg sm:rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:bg-[#0c0c14]/95 dark:border-white/10 dark:backdrop-blur-xl">
            {options.map((o, i) => (
              <Fragment key={o.value}>
                {o.group && o.group !== options[i - 1]?.group && (
                  <p className="truncate px-3 pt-2 pb-0.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{o.group}</p>
                )}
                <button
                  type="button"
                  title={o.label}
                  data-current={o.value === value ? "true" : undefined}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`block w-full truncate px-3 py-2 text-left text-[12px] sm:text-[13px] hover:bg-zinc-100 dark:hover:bg-white/10 ${o.value === value ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200 font-medium" : o.green ? "font-medium text-emerald-600 dark:text-emerald-400" : ""}`}
                >
                  {o.green && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" aria-hidden />}
                  {o.label}
                </button>
              </Fragment>
            ))}
          </div>
        </>
      )}

      {open && !disabled && sheetMode && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex flex-col justify-end sm:hidden">
            <button aria-label="Хаах" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
            <div
              ref={sheetRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              className="relative flex max-h-[80vh] w-full flex-col rounded-t-2xl border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none dark:border-white/10 dark:bg-[#0c0c14]"
            >
              <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
                <span className="truncate text-[13px] font-semibold text-zinc-700 dark:text-zinc-200">{ariaLabel ?? "Сонгох"}</span>
                <button onClick={() => setOpen(false)} aria-label="Хаах" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-[13px] text-zinc-500 dark:border-white/15 dark:text-zinc-400">✕</button>
              </div>
              {options.length > 8 && (
                <div className="px-4 pb-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Хайх..."
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  />
                </div>
              )}
              <div ref={sheetListRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
                {shown.map((o, i) => (
                  <Fragment key={o.value}>
                    {o.group && o.group !== shown[i - 1]?.group && (
                      <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{o.group}</p>
                    )}
                    <button
                      type="button"
                      data-current={o.value === value ? "true" : undefined}
                      onClick={() => { onChange(o.value); setOpen(false); }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-[14px] leading-snug ${o.value === value ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" : o.green ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-200"}`}
                    >
                      {o.green && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />}
                      <span className="min-w-0 flex-1 break-words">{o.label}</span>
                      {o.value === value && <span className="shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden>✓</span>}
                    </button>
                  </Fragment>
                ))}
                {shown.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-zinc-400">Илэрц олдсонгүй</p>}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
