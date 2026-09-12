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
    return <span className={`inline-flex h-8 w-8 rounded-full border dark:border-zinc-700 ${className}`} aria-hidden />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Гэрэл горим" : "Харанхуй горим"}
      title={dark ? "Гэрэл горим" : "Харанхуй горим"}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${className}`}
    >
      <span className="text-[15px] leading-none">{dark ? "☀" : "☾"}</span>
    </button>
  );
}
