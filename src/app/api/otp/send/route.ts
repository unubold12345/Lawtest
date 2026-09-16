import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCode, hashCode, normalizePhone, OTP_RATE_LIMIT_SECONDS, OTP_TTL_SECONDS, sendSms, smsConfigured } from "@/lib/otp";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const { phone: raw, purpose: rawPurpose } = await req.json();
    if (!raw) return NextResponse.json({ error: "Утас шаардлагатай" }, { status: 400 });
    const phone = normalizePhone(String(raw));
    if (!phone) return NextResponse.json({ error: "Утас буруу формат (+976 8xxx xxxx)" }, { status: 400 });
    const purpose = rawPurpose === "recover" ? "recover" : rawPurpose === "register" ? "register" : null;
    if (!purpose) return NextResponse.json({ error: "Зориулалт буруу: register эсвэл recover" }, { status: 400 });

    // no SMS provider in production → never create a code (and never log one)
    if (!smsConfigured() && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "SMS үйлчилгээ тохируулаагүй байна" }, { status: 500 });
    }
    if (!rateLimit(`otpsend:${clientIp(req)}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Хэт олон хүсэлт — дараа оролдоно уу" }, { status: 429 });
    }
    if (purpose === "recover") {
      const exists = await prisma.user.findFirst({ where: { phone } });
      if (!exists) return NextResponse.json({ error: "Энэ утсаар бүртгэл олдсонгүй" }, { status: 404 });
    }
    if (purpose === "register") {
      const exists = await prisma.user.findFirst({ where: { phone } });
      if (exists) return NextResponse.json({ error: "Энэ утас аль хэдийн бүртгэлтэй" }, { status: 409 });
    }

    // rate limit: 1 per minute per phone
    const recent = await prisma.otp.findFirst({
      where: { phone, createdAt: { gt: new Date(Date.now() - OTP_RATE_LIMIT_SECONDS * 1000) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      const wait = Math.ceil((recent.createdAt.getTime() + OTP_RATE_LIMIT_SECONDS * 1000 - Date.now()) / 1000);
      return NextResponse.json({ error: `Дахин ${wait} сек дараа оролдоно уу` }, { status: 429 });
    }

    const code = generateCode();
    const codeHash = await hashCode(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    await prisma.otp.create({ data: { phone, codeHash, purpose, expiresAt } });

    const { mocked, messageId } = await sendSms(phone, code);

    // Never hand out the code in production: if SMS isn't configured there,
    // fail loudly instead of silently giving out a bypass code.
    if (mocked && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "SMS үйлчилгээ тохируулаагүй байна" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      mocked,
      messageId,
      // dev only: expose code so you don't need real SMS to test locally
      ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
      ttl: OTP_TTL_SECONDS,
    });
  } catch (e) {
    console.error("otp/send", e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}
