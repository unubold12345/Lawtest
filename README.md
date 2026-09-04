# LawTest — Хуулийн шалгалт

Next.js 16 + Prisma + Auth.js (NextAuth v5) + SQLite (dev) / Postgres (prod). 123 асуулт бэлэн, localStorage fallback зочин хэрэглэгчдэд.

## Stack
- Next.js 16 App Router, TypeScript, Tailwind 4, Turbopack
- Prisma 6 + SQLite (dev) → Postgres (prod: Neon/Supabase) нэг schema
- Auth.js v5 Credentials + @auth/prisma-adapter + bcryptjs

## Quick start (dev — SQLite, no external DB)
```bash
npm install
# .env already has DATABASE_URL="file:./dev.db" + AUTH_SECRET
npx prisma migrate dev   # dev.db үүснэ (commit-лэгдэхгүй)
npm run dev              # http://localhost:3000
```
Бүртгүүлэх → нэвтрэх → шалгалт → түүх DB-д хадгалагдана. Нэвтрээгүй зочин localStorage fallback.

## Postgres рүү шилжих (100 хэрэглэгч, prod)
1. Neon/Supabase дээр DB үүсгэ → `DATABASE_URL="postgresql://...?sslmode=require"` ав.
2. `.env` + Vercel Env-д солино.
3. `prisma/schema.prisma` → `provider = "postgresql"` болго.
4. `npx prisma migrate dev --name pg_init` (эсвэл `npx prisma db push` анхны deploy)
5. `npx prisma generate && npm run build` шалга.

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
