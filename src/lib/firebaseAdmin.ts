import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Server-side Firebase token verifier. No service-account key needed:
// verifyIdToken only fetches Google's public certs + checks against projectId.
function adminApp(): App {
  return (
    getApps()[0] ??
    initializeApp({
      projectId:
        process.env.FIREBASE_PROJECT_ID ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        "lexlab-3626a",
    })
  );
}

// Returns the verified E.164 phone number from a Firebase ID token, or null.
export async function verifyFirebaseToken(idToken: string): Promise<string | null> {
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(idToken);
    const phone = (decoded as { phone_number?: unknown }).phone_number;
    return typeof phone === "string" && phone.startsWith("+") ? phone : null;
  } catch {
    return null;
  }
}
