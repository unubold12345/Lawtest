"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function isAppleTouchBrowser() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export default function SafeAreaScrollNudge() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isAppleTouchBrowser()) return;

    const frame = requestAnimationFrame(() => {
      if (window.scrollY < 1) window.scrollTo(0, 1);
    });

    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
