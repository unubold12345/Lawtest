"use client";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

// Keeps the pre-paint `lexlab-paid` html class (see layout head script + globals.css)
// in sync with the live session so paid users never see paywall promos flash.
export default function PaidFlag() {
  const { data: session, status } = useSession();
  const user = session?.user as unknown as { hasPaid?: boolean; role?: string } | undefined;
  const paid = user?.hasPaid === true || user?.role === "ADMIN";

  useEffect(() => {
    if (status === "loading") return;
    document.documentElement.classList.toggle("lexlab-paid", paid);
    try {
      localStorage.setItem("lexlab_paid", paid ? "1" : "0");
    } catch {}
  }, [paid, status]);

  return null;
}
