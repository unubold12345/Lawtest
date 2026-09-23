"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { scrollRoot } from "@/lib/scrollRoot";

export default function ScrollReset() {
  const pathname = usePathname();
  useEffect(() => {
    scrollRoot()?.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
