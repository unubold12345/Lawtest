import { createRemoteJWKSet, jwtVerify } from "jose";

// Server-side Firebase ID token verifier (no firebase-admin: it pulls in
// jwks-rsa → jose@6, which breaks `require()` in Vercel's CJS runtime).
// Google's public securetoken JWKS + issuer/audience checks are all that's needed.
const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

function projectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "lexlab-3626a"
  );
}

// Returns the verified E.164 phone number from a Firebase ID token, or null.
export async function verifyFirebaseToken(idToken: string): Promise<string | null> {
  try {
    const pid = projectId();
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${pid}`,
      audience: pid,
      algorithms: ["RS256"],
    });
    if (!payload.sub) return null;
    const phone = (payload as { phone_number?: unknown }).phone_number;
    return typeof phone === "string" && phone.startsWith("+") ? phone : null;
  } catch {
    return null;
  }
}
