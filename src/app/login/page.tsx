"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isReg, setIsReg] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (session?.user) {
    return (
      <div className="mx-auto max-w-md mt-10 rounded-2xl border bg-white p-8 text-center dark:bg-zinc-900 dark:border-zinc-800">
        <p>Нэвтэрсэн: <b>{session.user.name || session.user.email}</b> ({session.user.email})</p>
        <button onClick={() => router.push("/")} className="mt-4 rounded-full bg-zinc-900 px-6 py-2 text-white dark:bg-white dark:text-zinc-900">Нүүр рүү</button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      if (isReg) {
        const r = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name || email.split("@")[0], email, password }),
        });
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "Бүртгэл амжилтгүй"); setLoading(false); return; }
      }
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) { setErr("Имэйл эсвэл нууц үг буруу"); setLoading(false); return; }
      router.push("/");
      router.refresh();
    } catch {
      setErr("Серверийн алдаа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md mt-10 rounded-2xl border bg-white p-8 dark:bg-zinc-900 dark:border-zinc-800">
      <h1 className="text-xl font-semibold">{isReg ? "Бүртгүүлэх" : "Нэвтрэх"}</h1>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        {isReg && <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Нэр" className="rounded-xl border px-4 py-3 dark:bg-zinc-800 dark:border-zinc-700" />}
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="И-мэйл" className="rounded-xl border px-4 py-3 dark:bg-zinc-800 dark:border-zinc-700" />
        <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Нууц үг (≥6)" className="rounded-xl border px-4 py-3 dark:bg-zinc-800 dark:border-zinc-700" />
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        <button disabled={loading} type="submit" className="rounded-full bg-zinc-900 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">{loading ? "..." : isReg ? "Бүртгүүлэх" : "Нэвтрэх"}</button>
      </form>
      <button onClick={() => setIsReg(!isReg)} className="mt-4 text-sm text-zinc-500 underline">{isReg ? "Аль хэдийн бүртгэлтэй юу? Нэвтрэх" : "Шинэ хэрэглэгч? Бүртгүүлэх"}</button>
    </div>
  );
}
