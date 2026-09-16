"use client";
import { useState } from "react";
import Link from "next/link";
import TermsModal from "@/components/TermsModal";

export default function PaymentRequestButton({ authed, initialPending }: { authed: boolean; initialPending: boolean }) {
  const [pending, setPending] = useState(initialPending);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const send = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/payment-requests", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Амжилтгүй");
      if (d.paid) {
        window.location.reload();
        return;
      }
      setPending(true);
    } catch (e: any) {
      setErr(e.message || "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  if (!authed) {
    return (
      <div>
        <Link
          href="/login?next=/plan"
          className="flex w-full items-center justify-center rounded-full bg-indigo-600 px-4 py-3 text-center leading-snug text-[14px] sm:text-base font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[48px]"
        >
          <span className="text-center leading-snug">Нэвтэрч ороод хүсэлт илгээх<span className="whitespace-nowrap"> →</span></span>
        </Link>
        <p className="mt-2 text-center text-[11px] sm:text-xs text-zinc-500">
          Эхлээд нэвтэрнэ үү — нэвтэрсний дараа энэ хуудас руу буцаж ирж, төлбөр төлсөн бол «Төлбөр төлсөн — эрх нээх хүсэлт илгээх» товчийг дарна уу.
        </p>
      </div>
    );
  }
  if (pending) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-400/30 dark:bg-amber-400/10">
        <p className="font-medium text-[14px] sm:text-base text-amber-700 dark:text-amber-300">⏳ Хүсэлт илгээгдсэн</p>
        <p className="mt-1 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">
          Админ төлбөрийг шалгаад эрхийг нээнэ. Эрх нээгдэхэд энэ хуудас өөрчлөгдөнө.
        </p>
      </div>
    );
  }
  return (
    <div>
      <button
        onClick={send}
        disabled={busy || !accepted}
        className="w-full rounded-full bg-indigo-600 px-4 py-3 text-center leading-snug text-[14px] sm:text-base font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[48px]"
      >
        {busy ? "Илгээж байна…" : "Төлбөр төлсөн — эрх нээх хүсэлт илгээх"}
      </button>
      <div className="mt-3 flex items-start gap-2.5">
        <input
          id="plan-accept-terms"
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-zinc-300 accent-indigo-600 dark:border-white/20"
        />
        <span className="text-[12px] sm:text-sm leading-snug text-zinc-600 dark:text-zinc-400">
          <label htmlFor="plan-accept-terms" className="cursor-pointer select-none">Би </label>
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="cursor-pointer font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200"
          >
            «Үйлчилгээний нөхцөл»
          </button>
          <label htmlFor="plan-accept-terms" className="cursor-pointer select-none">-ийг уншиж танилцсан бөгөөд зөвшөөрч байна.</label>
        </span>
      </div>
      {err && <p className="mt-2 text-center text-[12px] sm:text-sm text-rose-600 dark:text-rose-400">{err}</p>}
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  );
}
