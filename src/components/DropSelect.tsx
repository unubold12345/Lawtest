"use client";

import { useState } from "react";

export type DropOption = { value: string; label: string };

// Custom dropdown modeled on the quiz setup "Дэд ангилал сонгох…" picker:
// the panel is clipped to the trigger width (absolute left-0 right-0) with
// truncated options, so long category names can never overflow the card the
// way a native <select> open list does on Windows Chrome.
export default function DropSelect({
  value,
  onChange,
  options,
  buttonClassName,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropOption[];
  buttonClassName: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative w-full min-w-0">
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full max-w-full min-w-0 items-center justify-between gap-2 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        <span className="truncate text-left">{current ? current.label : ""}</span>
        <span className="shrink-0 text-xs text-zinc-400">{open ? "▴" : "▾"}</span>
      </button>
      {open && !disabled && (
        <>
          <button aria-label="close" onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default bg-transparent" />
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg sm:rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:bg-[#0c0c14]/95 dark:border-white/10 dark:backdrop-blur-xl">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                title={o.label}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`block w-full truncate px-3 py-2 text-left text-[12px] sm:text-[13px] hover:bg-zinc-100 dark:hover:bg-white/10 ${o.value === value ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200 font-medium" : ""}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
