"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

function sid(): string {
  try {
    let s = localStorage.getItem("lexlab_sid");
    if (!s || !/^[A-Za-z0-9\-_]{8,64}$/.test(s)) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      s = [...bytes].map((b) => ("0" + b.toString(16)).slice(-2)).join("");
      localStorage.setItem("lexlab_sid", s);
    }
    return s;
  } catch {
    return "";
  }
}

// Anonymous visit beacon: path + random session id only, no PII.
export default function VisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api/")) return;
    const id = sid();
    if (!id) return;
    const path = pathname;
    try {
      const payload = JSON.stringify({ path, sessionId: id });
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon("/api/track", blob)) return;
      }
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* best-effort */
    }
  }, [pathname]);
  return null;
}
