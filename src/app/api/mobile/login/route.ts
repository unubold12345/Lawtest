import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/otp";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { createMobileToken } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

// Same dummy hash as the web credentials provider so unknown phones cost a bcrypt compare too.
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

// POST { phone, password } -> { token, user } for the Expo app.
export async function POST(req: Request) {
  let body: { phone?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }

  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (!phone || !password || password.length > 200) {
    return NextResponse.json({ error: "Утас эсвэл нууц үг буруу" }, { status: 401 });
  }

  const ip = clientIp(req);
  if (!rateLimit(`mobile-login:phone:${phone}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Хэт олон оролдлого. Түр хүлээнэ үү." }, { status: 429 });
  }
  if (!rateLimit(`mobile-login:ip:${ip}`, 30, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Хэт олон оролдлого. Түр хүлээнэ үү." }, { status: 429 });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { phone },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        paidAt: true,
        createdAt: true,
        password: true,
      },
    });
    const ok = await bcrypt.compare(password, user?.password || DUMMY_HASH);
    if (!user || !user.password || !ok) {
      return NextResponse.json({ error: "Утас эсвэл нууц үг буруу" }, { status: 401 });
    }

    const token = await createMobileToken(user.id);
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email && !user.email.endsWith("@phone.local") ? user.email : null,
        role: user.role,
        paidAt: user.paidAt ? user.paidAt.toISOString() : null,
        hasPaid: user.role === "ADMIN" || !!user.paidAt,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("mobile-login", e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}
