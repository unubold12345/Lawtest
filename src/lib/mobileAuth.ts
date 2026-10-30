import { SignJWT, jwtVerify } from "jose";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MOBILE_TOKEN_ISSUER = "lexlab-mobile";
const MOBILE_TOKEN_TTL = "30d";

function mobileSecret(): Uint8Array {
  const value = process.env.MOBILE_JWT_SECRET || process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not configured");
  return new TextEncoder().encode(value);
}

export async function createMobileToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(MOBILE_TOKEN_ISSUER)
    .setIssuedAt()
    .setExpirationTime(MOBILE_TOKEN_TTL)
    .sign(mobileSecret());
}

type MobileIdentity = { userId: string; issuedAt: number | null };

async function mobileIdentity(req: Request): Promise<MobileIdentity | null> {
  const header = (req.headers.get("authorization") || "").trim();
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], mobileSecret(), {
      issuer: MOBILE_TOKEN_ISSUER,
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return {
      userId: payload.sub,
      issuedAt: typeof payload.iat === "number" ? payload.iat : null,
    };
  } catch {
    return null;
  }
}

// A mobile token is invalid when its user is gone or the password changed after it was issued.
async function validMobileUserId(req: Request): Promise<string | null> {
  const identity = await mobileIdentity(req);
  if (!identity) return null;
  try {
    const db = await prisma.user.findUnique({
      where: { id: identity.userId },
      select: { passwordChangedAt: true },
    });
    if (!db) return null;
    if (db.passwordChangedAt && identity.issuedAt !== null && db.passwordChangedAt.getTime() > identity.issuedAt * 1000) {
      return null;
    }
    return identity.userId;
  } catch {
    return null;
  }
}

// Accepts a mobile bearer token or a NextAuth cookie session.
export async function requestUserId(req: Request): Promise<string | null> {
  const bearerUserId = await validMobileUserId(req);
  if (bearerUserId) return bearerUserId;
  const session = await auth();
  return (session?.user as unknown as { id?: string })?.id ?? null;
}

// Reads the live role/paid status from the DB (never trusts token claims).
export async function requestAccessScope(req: Request): Promise<{ role: string | null; paidAt: Date | null }> {
  const userId = await requestUserId(req);
  if (!userId) return { role: null, paidAt: null };
  try {
    const db = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, paidAt: true } });
    return { role: db?.role ?? null, paidAt: db?.paidAt ?? null };
  } catch {
    return { role: null, paidAt: null };
  }
}
