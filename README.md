# Lexlab — Хуулийн шалгалт

Next.js 16 + Prisma (Postgres) + Auth.js v5. 143 асуулт (123 + 20 mock), localStorage fallback зочин.

## Stack
- Next.js 16 App Router, TypeScript, Tailwind 4, Turbopack
- Prisma 6 + Postgres (Neon pooled) — `provider = "postgresql"` (`prisma/schema.prisma:5`)
- Auth.js v5 Credentials + @auth/prisma-adapter + bcryptjs

## Quick start (Postgres — local + Vercel share)
```bash
npm install
# 1. Neon → Create project → connection string (pooled):
#    DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.neon.tech/neondb?sslmode=require"
# 2. .env + Vercel Env-д нэм:
#    DATABASE_URL, AUTH_SECRET, AUTH_URL=https://<your>.vercel.app
# 3. Push schema (first time, no migration history needed):
npx prisma db push        # or: npx prisma migrate dev --name init
npx prisma generate
npm run dev               # http://localhost:3000
```
Бүртгүүлэх → нэвтрэх → шалгалт → түүх/коммент/санал Postgres-д хуваалцагдана. `file:./dev.db` SQLite хасагдсан.

`.env.example` загвар, `prisma/dev.db` gitignore-д байна.

## Data
- `data/questions.json` — асуултууд (JSON). `data/README.md` формат.
- `GET /api/questions?full=1` — бүх асуулт (түүх дэлгэрэнгүйд).

## Auth API
- `POST /api/register` { name, email, password } → bcrypt 10
- `POST /api/auth/callback/credentials` (NextAuth) — `src/lib/auth.ts`
- `GET/POST/DELETE /api/attempts` — JWT-тай хэрэглэгчийн оролдлогууд (Prisma Attempt)

## Deploy (Vercel)
- Build: `next build` (Prisma generate автоматаар)
- Env: `DATABASE_URL`, `AUTH_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), `AUTH_URL`
