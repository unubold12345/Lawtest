import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizePhone, verifyCode } from "@/lib/otp";

export async function POST(req: Request) {
  try {
    const { password, phone: rawPhone, code } = await req.json();
    if (!rawPhone || !code || !password) return NextResponse.json({ error: "Утас, код, нууц үг шаардлагатай" }, { status: 400 });
    const phone = normalizePhone(String(rawPhone));
    if (!phone) return NextResponse.json({ error: "Утас буруу" }, { status: 400 });
    if (String(code).length !== 6) return NextResponse.json({ error: "Код 6 оронтой" }, { status: 400 });
    if (String(password).length < 6) return NextResponse.json({ error: "Нууц үг ≥6" }, { status: 400 });

    // OTP must be verified recently (register purpose)
    const otp = await prisma.otp.findFirst({
      where: { phone, purpose: "register", verified: true, expiresAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
    });
    // also allow if code matches an unverified but valid OTP (verify now)
    let verified = !!otp;
    if (!verified) {
      const pending = await prisma.otp.findFirst({ where: { phone, purpose: "register", verified: false, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
      if (pending) {
        const ok = await verifyCode(String(code), pending.codeHash);
        if (ok) {
          await prisma.otp.update({ where: { id: pending.id }, data: { verified: true } });
          verified = true;
        } else {
          await prisma.otp.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
        }
      }
    }
    if (!verified) return NextResponse.json({ error: "OTP баталгаажаагүй — кодоо шалгана уу" }, { status: 400 });

    const existsPhone = await prisma.user.findFirst({ where: { phone } });
    if (existsPhone) return NextResponse.json({ error: "Энэ утас бүртгэлтэй" }, { status: 409 });

    const cleanEmail = `${phone.replace("+", "")}@phone.local`;
    const existsEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
    const finalEmail = existsEmail ? `${phone.replace("+", "")}-${Date.now()}@phone.local` : cleanEmail;

    const hashed = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        name: phone,
        email: finalEmail,
        password: hashed,
        phone,
        phoneVerified: new Date(),
      },
    });
    return NextResponse.json({ ok: true, id: user.id, email: user.email });
  } catch (e) {
    console.error("register-phone", e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}
