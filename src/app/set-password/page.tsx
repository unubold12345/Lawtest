"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import BrandMark from "@/components/BrandMark";
import { passwordProblem } from "@/lib/password";

// Stash written by /login after the OTP is confirmed (register / recover flows).
const PW_SETUP_KEY = "lawtest:pw-setup";

type Setup = {
  purpose: "register" | "recover";
  phone: string;
  code?: string;
  firebaseToken?: string;
  next?: string;
};

export default function SetPasswordPage() {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // No stash (opened directly / refresh after finish) → back to login.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PW_SETUP_KEY);
      const d = raw ? (JSON.parse(raw) as Setup) : null;
      if (!d || (d.purpose !== "register" && d.purpose !== "recover") || !d.phone) {
        router.replace("/login");
        return;
      }
      setSetup(d);
      setReady(true);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  if (!ready || !setup) return null;

  const back = () => {
    sessionStorage.removeItem(PW_SETUP_KEY);
    router.push("/login");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const problem = passwordProblem(pw);
    if (problem) { setErr(problem); return; }
    if (pw !== pw2) { setErr("Нууц үг таарахгүй байна"); return; }
    setLoading(true);
    try {
      const isRegister = setup.purpose === "register";
      const body = isRegister
        ? { phone: setup.phone, password: pw, code: setup.code, firebaseToken: setup.firebaseToken }
        : { phone: setup.phone, newPassword: pw, code: setup.code, firebaseToken: setup.firebaseToken };
      const r = await fetch(isRegister ? "/api/auth/register-phone" : "/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setErr(d?.error || "Алдаа гарлаа — дахин оролдоно уу"); return; }
      sessionStorage.removeItem(PW_SETUP_KEY);
      // sign in with the fresh password (register: new account, recover: freshly reset)
      const res = await signIn("credentials", { phone: setup.phone, password: pw, redirect: false });
      if (res?.error) { setErr("Нэвтрэхэд алдаа гарлаа — Нэвтрэх хуудаснаас дахин оролдоно уу"); return; }
      const n = setup.next;
      router.push(n && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : "/");
      router.refresh();
    } catch { setErr("Серверийн алдаа"); } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col items-center justify-center px-4 py-10 sm:py-14">
      <div className="flex flex-col items-center text-center">
        <BrandMark size={56} />
        <p className="mt-4 text-2xl font-extrabold tracking-tight">Lexlab</p>
      </div>
      <div className="mt-6 sm:mt-8 w-full max-w-md rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-6 sm:p-10 shadow-xl shadow-zinc-900/5 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/30">
        <h1 className="text-center text-lg sm:text-xl font-semibold">
          {setup.purpose === "register" ? "Нууц үг тохируулах" : "Шинэ нууц үг тохируулах"}
        </h1>
        <p className="mt-3 text-center text-[12px] sm:text-sm text-zinc-500 dark:text-zinc-400">
          {setup.phone}
        </p>

        {err && <p className="mt-3 text-[13px] sm:text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 dark:bg-rose-400/10 dark:border-rose-400/30 dark:text-rose-400">{err}</p>}

        <form onSubmit={submit} className="mt-6 sm:mt-8 grid gap-4 sm:gap-5">
          <div>
            <input required type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Нууц үг" className="w-full rounded-xl border px-4 py-3.5 sm:py-4 text-sm sm:text-base dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[48px] sm:min-h-[52px]" />
            <ul className="mt-2.5 grid gap-1.5 pl-1 text-[12px] sm:text-[13px]">
              {[
                { ok: pw.length >= 8 && pw.length <= 20, label: "Дор хаяж 8 тэмдэгт" },
                { ok: /[0-9]/.test(pw), label: "Дор хаяж нэг тоо" },
              ].map((rule) => (
                <li key={rule.label} className={`flex items-center gap-2 transition-colors duration-200 ${rule.ok ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                  <span aria-hidden className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-200 ${rule.ok ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-400 dark:bg-white/10 dark:text-zinc-500"}`}>✓</span>
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>
          <input required type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Нууц үг давтах" className="rounded-xl border px-4 py-3.5 sm:py-4 text-sm sm:text-base dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[48px] sm:min-h-[52px]" />
          <button disabled={loading} type="submit" className="mt-1 rounded-full bg-indigo-600 py-3.5 sm:py-4 font-semibold text-sm sm:text-base text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:text-white dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[48px] sm:min-h-[52px]">{loading ? "..." : setup.purpose === "register" ? "Бүртгүүлэх" : "Сэргээх"}</button>
        </form>

        <p className="mt-5 sm:mt-6 text-center text-xs sm:text-sm text-zinc-500"><button onClick={back} className="underline font-medium text-zinc-700 dark:text-zinc-300">← Буцах</button></p>
      </div>
    </div>
  );
}
