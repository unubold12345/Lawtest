import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/otp";
import { clientIp, rateLimit } from "@/lib/rateLimit";

// Called by the login page "Код авах" button BEFORE any SMS is sent.
// register → phone must be new; recover → phone must already exist.
export async function POST(req: Request) {
  try {
    const { phone: raw, purpose: rawPurpose } = await req.json();
    if (!raw) return NextResponse.json({ error: "Утас шаардлагатай" }, { status: 400 });
    const phone = normalizePhone(String(raw));
    if (!phone) return NextResponse.json({ error: "Утас буруу — 8 оронтой дугаар оруулна уу" }, { status: 400 });
    const purpose = rawPurpose === "recover" ? "recover" : rawPurpose === "register" ? "register" : null;
    if (!purpose) return NextResponse.json({ error: "Зориулалт буруу: register эсвэл recover" }, { status: 400 });

    // cheap IP guard (the real send is capped separately in /api/otp/send)
    if (!rateLimit(`checkphone:${clientIp(req)}`, 60, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Хэт олон хүсэлт — дараа оролдоно уу" }, { status: 429 });
    }

    const exists = await prisma.user.findFirst({ where: { phone }, select: { id: true } });
    if (purpose === "register" && exists) {
      return NextResponse.json({ error: "Энэ утас аль хэдийн бүртгэлтэй — «Нэвтрэх» хэсгээр орно уу" }, { status: 409 });
    }
    if (purpose === "recover" && !exists) {
      return NextResponse.json({ error: "Энэ утсаар бүртгэл олдсонгүй" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("check-phone", e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}
