import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone, verifyCode } from "@/lib/otp";

export async function POST(req: Request) {
  try {
    const { phone: raw, code, purpose: rawPurpose } = await req.json();
    if (!raw || !code) return NextResponse.json({ error: "Утас болон код шаардлагатай" }, { status: 400 });
    const phone = normalizePhone(String(raw));
    if (!phone) return NextResponse.json({ error: "Утас буруу" }, { status: 400 });
    if (String(code).length !== 6) return NextResponse.json({ error: "Код 6 оронтой" }, { status: 400 });
    const purpose = rawPurpose === "recover" ? "recover" : rawPurpose === "register" ? "register" : null;
    // allow legacy login OTP for backward compat, but new register/recover require purpose
    const where: Record<string, unknown> = { phone, verified: false, expiresAt: { gt: new Date() } };
    if (purpose) (where as Record<string, unknown>).purpose = purpose;

    const otp = await prisma.otp.findFirst({
      where: where as never,
      orderBy: { createdAt: "desc" },
    });
    if (!otp) return NextResponse.json({ error: "Код олдоогүй / хугацаа дууссан, дахин илгээнэ үү" }, { status: 400 });
    if (otp.attempts >= 5) return NextResponse.json({ error: "Хэт олон оролдлого, дахин илгээнэ үү" }, { status: 429 });

    const ok = await verifyCode(String(code), otp.codeHash);
    if (!ok) {
      await prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      return NextResponse.json({ error: "Код буруу" }, { status: 400 });
    }

    // Mark verified — consumed for register/recover
    await prisma.otp.update({ where: { id: otp.id }, data: { verified: true } });

    // Ensure user exists / phoneVerified for register flow
    let user = await prisma.user.findFirst({ where: { phone } });
    if (!user && purpose === "register") {
      // don't create yet — register endpoint will create with name/password
      return NextResponse.json({ ok: true, purpose, verified: true });
    }
    if (user && !user.phoneVerified) {
      user = await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: new Date() } });
    }

    return NextResponse.json({ ok: true, purpose: purpose || otp.purpose, verified: true, userId: user?.id });
  } catch (e) {
    console.error("otp/verify", e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}
