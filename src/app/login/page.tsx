"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebaseClient";
import BrandMark from "@/components/BrandMark";

// Local number → E.164 (+976...) for Firebase SMS
function toE164(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length === 8) return "+976" + d;
  if (d.length === 11 && d.startsWith("976")) return "+" + d;
  return null;
}

// Where to land after auth — /login?next=/plan returns to the plan page.
// Only local paths are accepted (no open redirect).
function nextPath(): string {
  if (typeof window === "undefined") return "/";
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : "/";
}

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [view, setView] = useState<"login" | "register" | "recover">("login");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [fbConfirm, setFbConfirm] = useState<ConfirmationResult | null>(null);
  const [fbSentTo, setFbSentTo] = useState<string | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  // Already logged in → bounce straight home, no flash of the form.
  useEffect(() => {
    if (session?.user) router.replace(nextPath());
  }, [session, router]);

  // Switching views starts with empty inputs — typed text must not leak
  // into the other form (shared phone/password state).
  const switchView = (v: "login" | "register" | "recover") => {
    setView(v);
    setPhone("");
    setPassword("");
    setCode("");
    setOtpSent(false);
    setDevCode(null);
    setFbConfirm(null);
    setFbSentTo(null);
    setErr("");
    setOk("");
  };

  if (session?.user) {
    return null;
  }

  const startCooldown = () => {
    setCooldown(60);
    const id = setInterval(() => setCooldown((c) => { if (c <= 1) { clearInterval(id); return 0; } return c - 1; }), 1000);
  };

  // Firebase SMS (Google sends the code) — used when configured
  const sendFirebaseSms = async () => {
    const e164 = toE164(phone);
    if (!e164) { setErr("Утас буруу — 8 оронтой дугаар оруулна уу"); return; }
    try {
      const auth = firebaseAuth();
      // Always start with a fresh widget: a consumed/expired invisible
      // reCAPTCHA reused across clicks throws auth/invalid-app-credential.
      try { verifierRef.current?.clear(); } catch {}
      verifierRef.current = null;
      verifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      const conf = await signInWithPhoneNumber(auth, e164, verifierRef.current);
      setFbConfirm(conf);
      setFbSentTo(e164);
      setOtpSent(true);
      setOk("SMS код илгээлээ");
      startCooldown();
    } catch (e: unknown) {
      try { verifierRef.current?.clear(); } catch {}
      verifierRef.current = null;
      const code = (e as { code?: string })?.code || "";
      console.error("[firebase-sms]", code, e);
      const msg =
        code === "auth/operation-not-allowed" ? "Firebase-д Phone идэвхжээгүй байна (Enable → Save)"
        : code === "auth/unauthorized-domain" ? "Домэйн зөвшөөрөгдөөгүй (Authorized domains)"
        : code === "auth/billing-not-enabled" ? "Firebase Blaze төлбөрийн төлөв шаардлагатай"
        : code === "auth/quota-exceeded" || code === "auth/too-many-requests" ? "SMS квот дууссан — түр хүлээнэ үү"
        : code === "auth/captcha-check-failed" ? "reCAPTCHA блоклогдсон — adblock унтрааж дахин оролдоно уу"
        : code === "auth/invalid-app-credential" ? "Google аппыг танихгүй байна — түр хүлээгээд дахин оролдоно уу"
        : code === "auth/invalid-phone-number" ? "Утас буруу — 8 оронтой дугаар оруулна уу"
        : `SMS илгээж чадсангүй (${code || "тодорхойгүй"}) — зургийг явуулна уу`;
      setErr(msg);
    }
  };

  // Server OTP fallback (Twilio/SNS/dev mock) — /api/otp/send
  const sendOtp = async (purpose: "register" | "recover") => {
    setErr(""); setOk(""); setDevCode(null); setFbConfirm(null); setFbSentTo(null);
    if (!phone.trim()) { setErr("Утас оруулна уу"); return; }
    setLoading(true);
    try {
      if (firebaseConfigured()) { await sendFirebaseSms(); return; }
      const r = await fetch("/api/otp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, purpose }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Илгээж чадсангүй"); return; }
      setOtpSent(true);
      if (d.devCode) setDevCode(d.devCode);
      setOk(purpose === "register" ? "Бүртгэлийн код илгээлээ" : "Сэргээх код илгээлээ");
      startCooldown();
    } catch { setErr("Серверийн алдаа"); } finally { setLoading(false); }
  };

  // Confirm Firebase SMS code → ID token for our API (null = legacy OTP path)
  const confirmFirebase = async (): Promise<string | null> => {
    if (!fbConfirm) return null;
    if (toE164(phone) !== fbSentTo) { setErr("Дугаар солигдсон — код дахин авна уу"); return null; }
    try {
      const cred = await fbConfirm.confirm(code);
      return await cred.user.getIdToken();
    } catch { setErr("Код буруу"); return null; }
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const res = await signIn("credentials", { phone, password, redirect: false });
      if (res?.error) { setErr("Утас эсвэл нууц үг буруу"); return; }
      router.push(nextPath()); router.refresh();
    } catch { setErr("Серверийн алдаа"); } finally { setLoading(false); }
  };

  // OTP confirmed → continue on the set-password page (password + repeat there)
  const gotoSetPassword = async (e: React.FormEvent, purpose: "register" | "recover") => {
    e.preventDefault(); setErr(""); setOk(""); setLoading(true);
    try {
      const stash: Record<string, string> = { purpose, phone, next: nextPath() };
      if (fbConfirm) {
        const token = await confirmFirebase();
        if (!token) return;
        stash.firebaseToken = token;
      } else {
        const r = await fetch("/api/otp/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code, purpose }) });
        const d = await r.json().catch(() => null);
        if (!r.ok) { setErr(d?.error || "Код баталгаажуулж чадсангүй"); return; }
        stash.code = code;
      }
      sessionStorage.setItem("lawtest:pw-setup", JSON.stringify(stash));
      router.push("/set-password");
    } catch { setErr("Серверийн алдаа"); } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col items-center justify-center px-4 py-10 sm:py-14">
      <div className="flex flex-col items-center text-center">
        <BrandMark size={56} />
        <p className="mt-4 text-2xl font-extrabold tracking-tight">Lexlab</p>
        <p className="mt-2 text-[13px] sm:text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">2026 оны Хуульчийн Мэргэжлийн Шалгалтын Сорилго</p>
      </div>
    <div className="mt-6 sm:mt-8 w-full max-w-md rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-6 sm:p-10 shadow-xl shadow-zinc-900/5 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/30">
      <div id="recaptcha-container" />
      <h1 className="text-center text-lg sm:text-xl font-semibold">{view === "login" ? "Нэвтрэх" : view === "register" ? "Бүртгүүлэх" : "Нууц үг сэргээх"}</h1>

      {ok && <p className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-[13px] sm:text-sm text-emerald-700 dark:bg-emerald-400/10 dark:border-emerald-400/30 dark:text-emerald-300">{ok}</p>}
      {err && <p className="mt-3 text-[13px] sm:text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 dark:bg-rose-400/10 dark:border-rose-400/30 dark:text-rose-400">{err}</p>}

      {view === "login" && (
        <>
          <form onSubmit={submitLogin} className="mt-6 sm:mt-8 grid gap-4 sm:gap-5">
            <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Утас" inputMode="tel" className="rounded-xl border px-4 py-3.5 sm:py-4 text-sm sm:text-base dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[48px] sm:min-h-[52px]" />
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Нууц үг" className="rounded-xl border px-4 py-3.5 sm:py-4 text-sm sm:text-base dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[48px] sm:min-h-[52px]" />
            <button disabled={loading} type="submit" className="mt-1 rounded-full bg-indigo-600 py-3.5 sm:py-4 font-semibold text-sm sm:text-base text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[48px] sm:min-h-[52px]">{loading ? "..." : "Нэвтрэх"}</button>
          </form>
          <div className="mt-5 sm:mt-6 flex items-center justify-between text-xs sm:text-sm text-zinc-500">
            <button onClick={() => switchView("recover")} className="underline">Нууц үг мартсан?</button>
            <button onClick={() => switchView("register")} className="underline font-medium text-zinc-700 dark:text-zinc-300">Бүртгүүлэх</button>
          </div>
        </>
      )}

      {view === "register" && (
        <>
          <form onSubmit={(e) => gotoSetPassword(e, "register")} className="mt-6 sm:mt-8 grid gap-4 sm:gap-5">
            <div className="flex gap-2">
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Утас" inputMode="tel" className="flex-1 rounded-xl border px-4 py-3.5 sm:py-4 text-sm sm:text-base dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[48px] sm:min-h-[52px]" />
              <button type="button" onClick={() => sendOtp("register")} disabled={loading || cooldown > 0} className="rounded-full border px-4 py-3 text-xs sm:text-sm font-medium disabled:opacity-40 dark:border-white/15 min-h-[48px] sm:min-h-[52px] shrink-0">{cooldown > 0 ? `${cooldown}с` : "Код авах"}</button>
            </div>
            {otpSent && <input required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Баталгаажуулах код" inputMode="numeric" className="rounded-xl border px-4 py-3.5 sm:py-4 text-center tracking-[0.3em] text-sm sm:text-base dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[48px] sm:min-h-[52px]" />}
            {devCode && <p className="rounded-xl border border-dashed px-3 py-2 text-[13px] sm:text-sm text-zinc-500 break-all dark:border-white/15">Код: <b className="tracking-widest text-zinc-900 dark:text-white">{devCode}</b></p>}
            <button disabled={loading || !otpSent || code.length !== 6} type="submit" className="mt-1 rounded-full bg-indigo-600 py-3.5 sm:py-4 font-semibold text-sm sm:text-base text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[48px] sm:min-h-[52px]">{loading ? "..." : "Үргэлжлүүлэх"}</button>
          </form>
          <p className="mt-5 sm:mt-6 text-center text-xs sm:text-sm text-zinc-500">Бүртгэлтэй юу? <button onClick={() => switchView("login")} className="underline font-medium text-zinc-700 dark:text-zinc-300">Нэвтрэх</button></p>
        </>
      )}

      {view === "recover" && (
        <>
          <form onSubmit={(e) => gotoSetPassword(e, "recover")} className="mt-6 sm:mt-8 grid gap-4 sm:gap-5">
            <div className="flex gap-2">
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Утас" inputMode="tel" className="flex-1 rounded-xl border px-4 py-3.5 sm:py-4 text-sm sm:text-base dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[48px] sm:min-h-[52px]" />
              <button type="button" onClick={() => sendOtp("recover")} disabled={loading || cooldown > 0} className="rounded-full border px-4 py-3 text-xs sm:text-sm font-medium disabled:opacity-40 dark:border-white/15 min-h-[48px] sm:min-h-[52px] shrink-0">{cooldown > 0 ? `${cooldown}с` : "Код авах"}</button>
            </div>
            {devCode && <p className="rounded-xl border border-dashed px-3 py-2 text-[13px] sm:text-sm text-zinc-500 break-all dark:border-white/15">Код: <b className="tracking-widest text-zinc-900 dark:text-white">{devCode}</b></p>}
            {otpSent && <input required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Баталгаажуулах код" inputMode="numeric" className="rounded-xl border px-4 py-3.5 sm:py-4 text-center tracking-[0.3em] text-sm sm:text-base dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[48px] sm:min-h-[52px]" />}
            <button disabled={loading || code.length !== 6} type="submit" className="mt-1 rounded-full bg-indigo-600 py-3.5 sm:py-4 font-semibold text-sm sm:text-base text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[48px] sm:min-h-[52px]">{loading ? "..." : "Үргэлжлүүлэх"}</button>
          </form>
          <p className="mt-5 sm:mt-6 text-center text-xs sm:text-sm text-zinc-500"><button onClick={() => switchView("login")} className="underline font-medium text-zinc-700 dark:text-zinc-300">← Нэвтрэх рүү буцах</button></p>
        </>
      )}
    </div>
    </div>
  );
}
