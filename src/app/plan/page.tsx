import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FREE_CATEGORY, PLAN_PRICE } from "@/lib/access";
import PaymentRequestButton from "@/components/PaymentRequestButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Эрх авах — Lexlab",
  description: "40,000₮ нэг удаагийн төлбөрөөр бүх сорилго, шалгалт, хадгалах цэсийг нээх",
};

const priceFmt = new Intl.NumberFormat("mn-MN").format(PLAN_PRICE);

export default async function PlanPage() {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  let hasPaid = false;
  let pendingRequest = false;
  if (userId) {
    try {
      const db = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, paidAt: true },
      });
      hasPaid = !!db && (db.role === "ADMIN" || !!db.paidAt);
      if (!hasPaid) {
        const req = await prisma.paymentRequest.findFirst({
          where: { userId, status: "PENDING" },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        pendingRequest = !!req;
      }
    } catch {}
  }
  let qrExists = false;
  try {
    qrExists = fs.existsSync(path.join(process.cwd(), "public", "payment-qr.png"));
  } catch {}

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-6 py-6 sm:py-10 space-y-4 sm:space-y-6">
      <div className="text-center">
        <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">Төлбөртэй төлөвлөгөө</p>
        <h1 className="mt-1 text-[22px] sm:text-3xl font-extrabold tracking-tight">Эрх авах</h1>
        <p className="mt-2 text-[13px] sm:text-base text-zinc-500">
          Нэг удаа <b className="text-zinc-900 dark:text-white">{priceFmt}₮</b> төлөөд бүх эрхээ насан туршдаа нээнэ.
        </p>
      </div>

      {hasPaid ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 sm:p-6 text-center dark:bg-green-950/20 dark:border-green-900">
          <p className="text-2xl">✓</p>
          <p className="mt-1 font-semibold text-[15px] sm:text-lg">Эрх нээгдсэн</p>
          <p className="mt-1 text-[12px] sm:text-sm text-zinc-600 dark:text-zinc-400">
            Танд бүх ангилал, шалгалт, хадгалах цэс нээлттэй.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
            <Link href="/browse" className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900 min-h-[44px] inline-flex items-center justify-center">Бүх сорилго →</Link>
            <Link href="/quiz" className="rounded-full border px-6 py-2.5 text-sm dark:border-zinc-700 min-h-[44px] inline-flex items-center justify-center">Шалгалт өгөх →</Link>
          </div>
        </div>
      ) : (
        <>
          {/* price card */}
          <div className="rounded-2xl border bg-white p-5 sm:p-6 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="font-semibold text-[14px] sm:text-base">Бүтэн эрх</p>
                <p className="text-[11px] sm:text-xs text-zinc-500">Нэг удаагийн төлбөр · насан турш</p>
              </div>
              <p className="text-[22px] sm:text-3xl font-extrabold tracking-tight">{priceFmt}₮</p>
            </div>
            <div className="mt-4 grid gap-2 text-[12px] sm:text-sm">
              <div className="flex justify-between rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800"><span>🆓 Үнэгүй</span><span className="text-zinc-500">{FREE_CATEGORY} · 1815 сорилго</span></div>
              <div className="flex justify-between rounded-xl bg-zinc-900 text-white px-3 py-2 dark:bg-white dark:text-zinc-900"><span>🔓 Эрхтэй</span><span>Бүх ангилал + хадгалах</span></div>
            </div>
            <div className="mt-4 grid gap-1.5 text-[12px] sm:text-sm">
              <p>✓ Бүх дэд ангиллын сорилго харах</p>
              <p>✓ Бүх ангиллаар шалгалт өгөх</p>
              <p>✓ Зөв хариулт хадгалах</p>
              <p>✓ Шалгалт түр зогсоож, үргэлжлүүлэх</p>
            </div>
          </div>

          {/* payment */}
          <div className="rounded-2xl border bg-white p-5 sm:p-6 dark:bg-zinc-900 dark:border-zinc-800">
            <p className="font-semibold text-[14px] sm:text-base">1. QR-аар {priceFmt}₮ төлөх</p>
            <div className="mt-3 flex justify-center">
              {qrExists ? (
                <Image src="/payment-qr.png" alt="Төлбөрийн QR" width={256} height={256} className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl border object-contain bg-white" />
              ) : (
                <div className="flex w-56 h-56 sm:w-64 sm:h-64 items-center justify-center rounded-2xl border border-dashed text-center text-[12px] text-zinc-400 px-6">
                  Төлбөрийн QR удахгүй байршина
                </div>
              )}
            </div>
            <p className="mt-4 font-semibold text-[14px] sm:text-base">2. Дансаар төлөх</p>
            <div className="mt-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
              <div className="flex items-center gap-3">
                <Image src="/golomt-logo.png" alt="Голомт банк" width={651} height={318} className="h-10 sm:h-12 w-auto object-contain bg-white rounded-lg px-2 py-1 border border-zinc-100 dark:border-zinc-700" />
                <p className="font-semibold text-[13px] sm:text-sm">Голомт банк</p>
              </div>
              <dl className="mt-3 grid gap-2 text-[12px] sm:text-sm">
                <div className="flex justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                  <dt className="text-zinc-500">IBAN</dt>
                  <dd className="font-mono font-semibold tracking-wider">06001500</dd>
                </div>
                <div className="flex justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                  <dt className="text-zinc-500">Данс</dt>
                  <dd className="font-mono font-semibold tracking-[0.2em]">2405 1622 19</dd>
                </div>
                <div className="flex justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                  <dt className="text-zinc-500">Хүлээн авагч</dt>
                  <dd className="font-semibold text-right">Лхамсүрэн Өнөболд</dd>
                </div>
                <div className="flex justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
                  <dt className="text-zinc-500">Гүйлгээний утга</dt>
                  <dd className="font-semibold text-right">Бүртгэлтэй утасны дугаар</dd>
                </div>
              </dl>
            </div>
            <p className="mt-4 font-semibold text-[14px] sm:text-base">3. Төлбөр төлснөө мэдэгдэх</p>
            <p className="mt-1 text-[12px] sm:text-sm text-zinc-500">
              Төлбөрөө төлсний дараа доорх товчийг дарна уу — админ шалгаад эрхийг нээнэ.
            </p>
            <div className="mt-3">
              <PaymentRequestButton authed={!!userId} initialPending={pendingRequest} />
            </div>
            <p className="mt-4 font-semibold text-[14px] sm:text-base">4. Эрх нээгдэнэ</p>
            <p className="mt-1 text-[12px] sm:text-sm text-zinc-500">
              Баталгаажсаны дараа дахин нэвтрэх шаардлагагүй — бүх ангилал автоматаар нээгдэнэ.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
