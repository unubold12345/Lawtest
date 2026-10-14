import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizePhone, OTP_MAX_ATTEMPTS, verifyCode } from "@/lib/otp";
import { verifyFirebaseToken } from "@/lib/firebaseAdmin";
import { passwordProblem } from "@/lib/password";

export async function POST(req: Request) {
  try {
    let otpId: string | null = null;
    const { phone: rawPhone, code, newPassword, firebaseToken } = await req.json();
    if (!rawPhone || !newPassword) return NextResponse.json({ error: "Утас, шинэ нууц үг шаардлагатай" }, { status: 400 });
    const phone = normalizePhone(String(rawPhone));
    if (!phone) return NextResponse.json({ error: "Утас буруу" }, { status: 400 });
    const pwProblem = passwordProblem(String(newPassword));
    if (pwProblem) return NextResponse.json({ error: pwProblem }, { status: 400 });

    // Firebase SMS path: verified ID token replaces our OTP code
    if (firebaseToken) {
      const fbPhone = await verifyFirebaseToken(String(firebaseToken));
      if (!fbPhone || normalizePhone(fbPhone) !== phone) {
        return NextResponse.json({ error: "Утас баталгаажаагүй — код дахин авна уу" }, { status: 400 });
      }
    } else {
      if (!code) return NextResponse.json({ error: "Код шаардлагатай" }, { status: 400 });
      // The submitted code must match on every reset — a verified OTP row alone
      // (verified=true from /api/otp/verify) is not proof from this caller.
      // Grace window keeps the two-step flow (verify → set-password) working.
      const otp = await prisma.otp.findFirst({
        where: {
          phone,
          purpose: "recover",
          OR: [
            { verified: true, expiresAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
            { verified: false, expiresAt: { gt: new Date() } },
          ],
        },
        orderBy: { createdAt: "desc" },
      });
      if (!otp) return NextResponse.json({ error: "Код олдоогүй / дууссан" }, { status: 400 });
      if (otp.attempts >= OTP_MAX_ATTEMPTS) return NextResponse.json({ error: "Хэт олон оролдлого" }, { status: 429 });
      const ok = await verifyCode(String(code), otp.codeHash);
      if (!ok) {
        await prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
        return NextResponse.json({ error: "Код буруу" }, { status: 400 });
      }
      otpId = otp.id;
    }

    const user = await prisma.user.findFirst({ where: { phone } });
    if (!user) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });

    const hashed = await bcrypt.hash(String(newPassword), 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed, phoneVerified: new Date(), passwordChangedAt: new Date() } });
    // consume the reset grant — the same code cannot be replayed
    if (otpId) await prisma.otp.deleteMany({ where: { id: otpId } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("recover", e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}
