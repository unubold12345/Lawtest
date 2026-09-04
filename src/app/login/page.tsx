"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login, register, user } = useAuth();
  const router = useRouter();
  const [isReg, setIsReg] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  if (user) {
    return (
      <div className="mx-auto max-w-md mt-10 rounded-2xl border bg-white p-8 text-center dark:bg-zinc-900 dark:border-zinc-800">
        <p>Нэвтэрсэн: <b>{user.name}</b> ({user.email})</p>
        <button onClick={() => router.push("/")} className="mt-4 rounded-full bg-zinc-900 px-6 py-2 text-white dark:bg-white dark:text-zinc-900">Нүүр рүү</button>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (isReg) register(name || email.split("@")[0], email);
    else login(email, name);
    router.push("/");
  };

  return (
    <div className="mx-auto max-w-md mt-10 rounded-2xl border bg-white p-8 dark:bg-zinc-900 dark:border-zinc-800">
      <h1 className="text-xl font-semibold">{isReg ? "Бүртгүүлэх" : "Нэвтрэх"}</h1>
      <p className="mt-1 text-sm text-zinc-500">Демо нэвтрэлт — localStorage-д хадгална. 100 хэрэглэгчид хангалттай, дараа нь DB руу шилжинэ.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        {isReg && <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Нэр" className="rounded-xl border px-4 py-3 dark:bg-zinc-800 dark:border-zinc-700" />}
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="И-мэйл" className="rounded-xl border px-4 py-3 dark:bg-zinc-800 dark:border-zinc-700" />
        <input type="password" placeholder="Нууц үг (демо — шалгахгүй)" className="rounded-xl border px-4 py-3 dark:bg-zinc-800 dark:border-zinc-700" />
        <button type="submit" className="rounded-full bg-zinc-900 py-3 font-medium text-white dark:bg-white dark:text-zinc-900">{isReg ? "Бүртгүүлэх" : "Нэвтрэх"}</button>
      </form>
      <button onClick={() => setIsReg(!isReg)} className="mt-4 text-sm text-zinc-500 underline">{isReg ? "Аль хэдийн бүртгэлтэй юу? Нэвтрэх" : "Шинэ хэрэглэгч? Бүртгүүлэх"}</button>
    </div>
  );
}
