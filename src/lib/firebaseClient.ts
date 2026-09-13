import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Client-side Firebase (phone SMS via Google). Public keys — safe to expose.
let app: FirebaseApp | null = null;

export function firebaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
}

const clean = (v: string | undefined) => (v || "").trim().replace(/^['"]+|['"]+$/g, "");

export function firebaseApp(): FirebaseApp {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) { app = existing; return app; }
  app = initializeApp({
    apiKey: clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: clean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  });
  return app;
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}
