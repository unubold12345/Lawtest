"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register" | "recover">("login");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  if (session?.user) {
    return (
      <div className="mx-auto max-w-md mt-6 sm:mt-10 mx-4 sm:mx-auto rounded-2xl border bg-white p-6 sm:p-8 text-center dark:bg-zinc-900 dark:border-zinc-800">
        <p className="text-sm sm:text-base break-words">Нэвтэрсэн: <b>{session.user.name || session.user.email}</b> ({session.user.email})</p>
        <button onClick={() => router.push("/")} className="mt-4 rounded-full bg-zinc-900 px-6 py-3 sm:py-2 text-sm text-white dark:bg-white dark:text-zinc-900 min-h-[44px]">Нүүр рүү</button>
      </div>
    );
  }

  const sendOtp = async (purpose: "register" | "recover") => {
    setErr(""); setOk(""); setDevCode(null);
    if (!phone.trim()) { setErr("Утас оруулна уу"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/otp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, purpose }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Илгээж чадсангүй"); return; }
      setOtpSent(true);
      if (d.devCode) setDevCode(d.devCode);
      setOk(purpose === "register" ? "Бүртгэлийн код илгээлээ" : "Сэргээх код илгээлээ");
      setCooldown(60);
      const id = setInterval(() => setCooldown((c) => { if (c <= 1) { clearInterval(id); return 0; } return c - 1; }), 1000);
    } catch { setErr("Серверийн алдаа"); } finally { setLoading(false); }
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const res = await signIn("credentials", { phone, password, redirect: false });
      if (res?.error) { setErr("Утас эсвэл нууц үг буруу"); return; }
      router.push("/"); router.refresh();
    } catch { setErr("Серверийн алдаа"); } finally { setLoading(false); }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setOk(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/register-phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code, password }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Бүртгэл амжилтгүй"); return; }
      setOk("Бүртгүүллээ — нэвтэрч байна...");
      const res = await signIn("credentials", { phone, password, redirect: false });
      if (res?.error) { setErr("Бүртгүүлсэн боловч нэвтрэхэд алдаа"); return; }
      router.push("/"); router.refresh();
    } catch { setErr("Серверийн алдаа"); } finally { setLoading(false); }
  };

  const submitRecover = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setOk(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code, newPassword }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Сэргээж чадсангүй"); return; }
      setOk("Нууц үг шинэчлэгдлээ — нэвтэрнэ үү");
      setTab("login"); setOtpSent(false); setCode(""); setNewPassword("");
    } catch { setErr("Серверийн алдаа"); } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-md mt-4 sm:mt-10 mx-3 sm:mx-auto rounded-xl sm:rounded-2xl border bg-white p-4 sm:p-8 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex gap-1 mb-3 sm:mb-4">
        <button onClick={() => { setTab("login"); setOtpSent(false); setErr(""); setOk(""); }} className={`flex-1 rounded-full py-2 sm:py-2 text-[11px] sm:text-xs font-medium border min-h-[34px] sm:min-h-0 ${tab === "login" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-50 dark:border-zinc-700"}`}>Нэвтрэх</button>
        <button onClick={() => { setTab("register"); setOtpSent(false); setErr(""); setOk(""); }} className={`flex-1 rounded-full py-2 sm:py-2 text-[11px] sm:text-xs font-medium border min-h-[34px] sm:min-h-0 ${tab === "register" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-50 dark:border-zinc-700"}`}>Бүртгүүлэх</button>
        <button onClick={() => { setTab("recover"); setOtpSent(false); setErr(""); setOk(""); }} className={`flex-1 rounded-full py-2 sm:py-2 text-[11px] sm:text-xs font-medium border min-h-[34px] sm:min-h-0 ${tab === "recover" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-50 dark:border-zinc-700"}`}>Сэргээх</button>
      </div>

      {ok && <p className="rounded-lg sm:rounded-xl bg-green-50 border border-green-200 px-2.5 py-1.5 text-[12px] sm:text-sm text-green-800 dark:bg-green-950/30">{ok}</p>}
      {err && <p className="mt-2 text-[12px] sm:text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg sm:rounded-xl px-2.5 py-1.5">{err}</p>}

      {tab === "login" && (
        <>
          <form onSubmit={submitLogin} className="mt-3 sm:mt-4 grid gap-2 sm:gap-3">
            <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Утас" inputMode="tel" className="rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]" />
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Нууц үг" className="rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]" />
            <button disabled={loading} type="submit" className="rounded-full bg-zinc-900 py-2.5 sm:py-3 font-medium text-[13px] sm:text-base text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900 min-h-[38px] sm:min-h-[48px]">{loading ? "..." : "Нэвтрэх"}</button>
          </form>
          <p className="mt-2 sm:mt-3 text-center text-[11px] sm:text-xs text-zinc-500"><button onClick={() => setTab("recover")} className="underline">Нууц үгээ мартсан?</button></p>
        </>
      )}

      {tab === "register" && (
        <>
          <form onSubmit={submitRegister} className="mt-3 sm:mt-4 grid gap-2 sm:gap-3">
            <div className="flex gap-1.5 sm:gap-2">
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Утас" inputMode="tel" className="flex-1 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]" />
              <button type="button" onClick={() => sendOtp("register")} disabled={loading || cooldown > 0} className="rounded-full border px-3 py-2 sm:px-4 sm:py-3 text-[11px] sm:text-xs font-medium disabled:opacity-40 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px] shrink-0">{cooldown > 0 ? `${cooldown}с` : "Код авах"}</button>
            </div>
            {otpSent && <input required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Баталгаажуулах код" inputMode="numeric" className="rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-center tracking-[0.3em] text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]" />}
            {devCode && <p className="rounded-lg sm:rounded-xl border border-dashed px-2.5 py-1.5 text-[12px] sm:text-sm text-zinc-500 break-all dark:border-zinc-700">Код: <b className="tracking-widest text-zinc-900 dark:text-white">{devCode}</b></p>}
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Нууц үг" className="rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]" />
            <button disabled={loading || !otpSent || code.length !== 6} type="submit" className="rounded-full bg-zinc-900 py-2.5 sm:py-3 font-medium text-[13px] sm:text-base text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900 min-h-[38px] sm:min-h-[48px]">{loading ? "..." : "Бүртгүүлэх"}</button>
          </form>
        </>
      )}

      {tab === "recover" && (
        <>
          <form onSubmit={submitRecover} className="mt-3 sm:mt-4 grid gap-2 sm:gap-3">
            <div className="flex gap-1.5 sm:gap-2">
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Утас" inputMode="tel" className="flex-1 rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]" />
              <button type="button" onClick={() => sendOtp("recover")} disabled={loading || cooldown > 0} className="rounded-full border px-3 py-2 sm:px-4 sm:py-3 text-[11px] sm:text-xs font-medium disabled:opacity-40 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px] shrink-0">{cooldown > 0 ? `${cooldown}с` : "Код авах"}</button>
            </div>
            {devCode && <p className="rounded-lg sm:rounded-xl border border-dashed px-2.5 py-1.5 text-[12px] sm:text-sm text-zinc-500 break-all dark:border-zinc-700">Код: <b className="tracking-widest text-zinc-900 dark:text-white">{devCode}</b></p>}
            {otpSent && <input required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Баталгаажуулах код" inputMode="numeric" className="rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-center tracking-[0.3em] text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]" />}
            <input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Шинэ нууц үг" className="rounded-lg sm:rounded-xl border px-3 py-2 sm:px-4 sm:py-3 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[36px] sm:min-h-[48px]" />
            <button disabled={loading || code.length !== 6} type="submit" className="rounded-full bg-zinc-900 py-2.5 sm:py-3 font-medium text-[13px] sm:text-base text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900 min-h-[38px] sm:min-h-[48px]">{loading ? "..." : "Сэргээх"}</button>
          </form>
        </>
      )}
    </div>
  );
}
