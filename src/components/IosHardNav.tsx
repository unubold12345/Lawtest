"use client";

import { useEffect } from "react";

function isAppleTouchBrowser() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function handleClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

  const target = e.target as Element | null;
  const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return;

  if (anchor.target && anchor.target !== "_self") return;
  if (anchor.hasAttribute("download")) return;

  const href = anchor.getAttribute("href") || "";
  if (!href || href.startsWith("#")) return;

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return;
  }
  if (url.origin !== window.location.origin) return;

  e.preventDefault();
  e.stopPropagation();
  window.location.assign(anchor.href);
}

export default function IosHardNav() {
  useEffect(() => {
    if (!isAppleTouchBrowser()) return;

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
