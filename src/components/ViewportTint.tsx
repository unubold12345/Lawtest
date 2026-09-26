"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const DARK = "#07070c";
const LIGHT = "#ffffff";

let lastColor = "";

function syncTint(force = false) {
  const root = document.documentElement;
  const color = root.classList.contains("dark") ? DARK : LIGHT;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  if (meta.getAttribute("content") !== color) meta.setAttribute("content", color);
  if (force || lastColor !== color) {
    lastColor = color;
    root.style.backgroundColor = color;
    void root.offsetHeight;
    requestAnimationFrame(() => {
      root.style.backgroundColor = "";
    });
    if (window.scrollY < 2) {
      window.scrollTo(0, 1);
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }
  }
}

export default function ViewportTint() {
  const pathname = usePathname();

  useEffect(() => {
    const observer = new MutationObserver(() => syncTint());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    syncTint(true);
  }, [pathname]);

  return null;
}
