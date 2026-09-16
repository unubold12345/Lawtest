import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { normalizePhone, OTP_MAX_ATTEMPTS, verifyCode } from "./otp";
import { nextUserName } from "./usernames";
import { rateLimit } from "./rateLimit";

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
        if (!rateLimit(`login:${phone}`, 15, 15 * 60 * 1000)) return null;
        const user = await prisma.user.findFirst({ where: { phone } });
        if (!user || !user.password) {
          await bcrypt.compare(String(password), "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy");
          return null;
        }
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email, role: (user as unknown as { role: string }).role };
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
        if (otp.attempts >= OTP_MAX_ATTEMPTS) return null;
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
            data: { phone, phoneVerified: new Date(), email: finalEmail, name: await nextUserName() },
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
        token.role = (user as unknown as { role?: string }).role;
        (token as unknown as { authTime: number }).authTime = Date.now();
      }
      // refresh role + display name + paid status from DB (handles promotion/rename/plan grant without relogin after next refresh)
      if (token.id) {
        try {
          const db = await prisma.user.findUnique({ where: { id: token.id as string }, select: { role: true, name: true, paidAt: true, passwordChangedAt: true } });
          if (db) {
            // session invalidation: tokens issued before the last password reset are dead
            const authTime = (token as unknown as { authTime?: number }).authTime;
            if (db.passwordChangedAt && authTime && db.passwordChangedAt.getTime() > authTime) return null;
            token.role = db.role;
            if (db.name) token.name = db.name;
            (token as unknown as { hasPaid: boolean }).hasPaid = db.role === "ADMIN" || !!db.paidAt;
          }
        } catch {}
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as unknown as { id: string }).id = token.id as string;
        (session.user as unknown as { role: string }).role = (token.role as string) || "USER";
        (session.user as unknown as { hasPaid: boolean }).hasPaid =
          (token as unknown as { hasPaid?: boolean }).hasPaid === true || (token.role as string) === "ADMIN";
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
});
