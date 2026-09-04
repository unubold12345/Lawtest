import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Имэйл болон нууц үг шаардлагатай" }, { status: 400 });
    }
    const cleanEmail = String(email).toLowerCase().trim();
    if (password.length < 6) {
      return NextResponse.json({ error: "Нууц үг дор хаяж 6 тэмдэгт байх ёстой" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json({ error: "Энэ имэйл бүртгэлтэй байна" }, { status: 409 });
    }
    const hashed = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: { name: String(name || cleanEmail.split("@")[0]), email: cleanEmail, password: hashed },
    });
    return NextResponse.json({ id: user.id, email: user.email });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}
