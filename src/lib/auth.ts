import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { normalizePhone, verifyCode } from "./otp";

if (process.env.AUTH_URL && !process.env.AUTH_URL.startsWith("http")) {
  process.env.AUTH_URL = `https://${process.env.AUTH_URL}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      id: "credentials",
      name: "Утас / Нууц үг",
      credentials: {
        phone: { label: "Утас", type: "text" },
        password: { label: "Нууц үг", type: "password" },
      },
      async authorize(credentials) {
        const rawPhone = (credentials?.phone as string) || ((credentials as Record<string, unknown>)?.email as string);
        const password = credentials?.password as string;
        const phone = rawPhone ? normalizePhone(String(rawPhone)) : null;
        if (!phone || !password) return null;
        const user = await prisma.user.findFirst({ where: { phone } });
        if (!user || !user.password) return null;
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
    Credentials({
      id: "phone-otp",
      name: "Утас OTP",
      credentials: {
        phone: { label: "Утас", type: "text" },
        code: { label: "Код", type: "text" },
      },
      async authorize(credentials) {
        const rawPhone = credentials?.phone as string;
        const code = credentials?.code as string;
        const phone = rawPhone ? normalizePhone(String(rawPhone)) : null;
        if (!phone || !code || code.length !== 6) return null;
        const otp = await prisma.otp.findFirst({
          where: { phone, verified: false, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        });
        if (!otp) return null;
        if (otp.attempts >= 5) return null;
        const ok = await verifyCode(String(code), otp.codeHash);
        if (!ok) {
          await prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
          return null;
        }
        await prisma.otp.update({ where: { id: otp.id }, data: { verified: true } });
        // find or create user by phone; keep email stable for authjs
        let user = await prisma.user.findFirst({ where: { phone } });
        if (!user) {
          const email = `${phone.replace("+", "")}@phone.local`;
          // if email collides (unlikely), fallback to cuid suffix
          const existingEmail = await prisma.user.findUnique({ where: { email } });
          const finalEmail = existingEmail ? `${phone.replace("+", "")}-${Date.now()}@phone.local` : email;
          user = await prisma.user.create({
            data: { phone, phoneVerified: new Date(), email: finalEmail, name: phone },
          });
        } else if (!user.phoneVerified) {
          user = await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: new Date() } });
        }
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as unknown as { id: string }).id = token.id as string;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
});
