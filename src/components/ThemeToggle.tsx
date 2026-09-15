"use client";
import { useEffect, useState } from "react";

const KEY = "lexlab_theme";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {}
  };

  if (!mounted) {
    return <span className={`inline-flex h-8 w-8 rounded-full border border-zinc-200 dark:border-white/15 ${className}`} aria-hidden />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Гэрэл горим" : "Харанхуй горим"}
      title={dark ? "Гэрэл горим" : "Харанхуй горим"}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5 ${className}`}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
        </svg>
      )}
    </button>
  );
}
