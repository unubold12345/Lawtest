"use client";
import { useState } from "react";
import Link from "next/link";

export default function PaymentRequestButton({ authed, initialPending }: { authed: boolean; initialPending: boolean }) {
  const [pending, setPending] = useState(initialPending);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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
          href="/login"
          className="flex w-full items-center justify-center rounded-full bg-zinc-900 py-3 text-[14px] sm:text-base font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 min-h-[48px]"
        >
          Нэвтэрч ороод хүсэлт илгээх →
        </Link>
        <p className="mt-2 text-center text-[11px] sm:text-xs text-zinc-500">
          Төлбөр төлсний дараа нэвтэрч орж «Төлбөр төлсөн» товчийг дарна уу.
        </p>
      </div>
    );
  }
  if (pending) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center dark:bg-amber-950/20 dark:border-amber-900">
        <p className="font-medium text-[14px] sm:text-base">⏳ Хүсэлт илгээгдсэн</p>
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
        disabled={busy}
        className="w-full rounded-full bg-zinc-900 py-3 text-[14px] sm:text-base font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 min-h-[48px]"
      >
        {busy ? "Илгээж байна…" : "Төлбөр төлсөн — эрх нээх хүсэлт илгээх"}
      </button>
      {err && <p className="mt-2 text-center text-[12px] sm:text-sm text-red-600">{err}</p>}
      <p className="mt-2 text-center text-[11px] sm:text-xs text-zinc-500">
        Аль хэдийн төлсөн бол <Link href="/login" className="underline">нэвтэрч орж</Link> хүсэлтээ илгээнэ үү.
      </p>
    </div>
  );
}
