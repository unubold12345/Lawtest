"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { passwordProblem } from "@/lib/password";
import ProfileStats from "@/components/ProfileStats";
import { computeStats, fmtDur, type RawAttempt } from "@/lib/profileStats";

type Profile = {
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  paidAt: string | null;
  createdAt: string;
  hasPassword: boolean;
  stats: { attempts: number; avgPct: number | null; saved: number; notes: number; mistakes: number };
  mistakesWrongCount: number;
  attemptsRaw: RawAttempt[];
};

type TabKey = "overview" | "stats" | "settings";

const inputCls =
  "w-full rounded-xl border px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60 min-h-[44px]";
const btnCls =
  "rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-60 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-violet-500 dark:shadow-lg dark:shadow-indigo-950/40 dark:hover:from-indigo-400 dark:hover:to-violet-400 min-h-[44px]";
const cardCls = "rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:bg-white/[0.04] dark:border-white/10";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Ерөнхий",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c1.5-3.2 4-4.8 7-4.8s5.5 1.6 7 4.8" />
      </svg>
    ),
  },
  {
    key: "stats",
    label: "Статистик",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <path d="M4 20h16" />
        <path d="M6.5 16v-4M11.5 16V6M16.5 16v-7" />
      </svg>
    ),
  },
  {
    key: "settings",
    label: "Тохиргоо",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="9" cy="17" r="2" />
      </svg>
    ),
  },
];

function Avatar({ name, cls }: { name: string; cls: string }) {
  const initials = name.trim().slice(0, 2).toUpperCase() || "?";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white ${cls}`}>
      {initials}
    </span>
  );
}

export default function ProfileClient() {
  const { data: session, status, update } = useSession();
  const isAuthed = !!session?.user;
  const [p, setP] = useState<Profile | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [nw2, setNw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (status === "loading" || !isAuthed) return;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || d.error) return;
        setP(d);
        setName(d.name || "");
      })
      .catch(() => {});
  }, [isAuthed, status]);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "stats" || t === "settings") setTab(t);
  }, []);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-2 sm:px-6 py-6 sm:py-10">
        <p className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:bg-white/[0.04] dark:border-white/10">
          Ачааллаж байна…
        </p>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-3xl px-2 sm:px-6 py-6 sm:py-10">
        <div className={`${cardCls} text-center`}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Профайлаа харахын тулд нэвтэрнэ үү.</p>
          <Link href="/login" className={`${btnCls} mt-4 inline-flex items-center`}>
            Нэвтрэх
          </Link>
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="mx-auto max-w-3xl px-2 sm:px-6 py-6 sm:py-10">
        <p className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:bg-white/[0.04] dark:border-white/10">
          Ачааллаж байна…
        </p>
      </div>
    );
  }

  const s = computeStats(p.attemptsRaw);
  const changeTab = (k: TabKey) => {
    setTab(k);
    window.scrollTo(0, 0);
    const url = new URL(window.location.href);
    if (k === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", k);
    window.history.replaceState(null, "", url.toString());
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameMsg(null);
    setSavingName(true);
    try {
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setNameMsg({ ok: false, text: d.error || "Хадгалж чадсангүй" });
        return;
      }
      setP((prev) => (prev ? { ...prev, name: d.name } : prev));
      setNameMsg({ ok: true, text: "Нэр хадгалагдлаа" });
      update();
    } catch {
      setNameMsg({ ok: false, text: "Серверийн алдаа" });
    } finally {
      setSavingName(false);
    }
  };

  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    const problem = passwordProblem(nw);
    if (problem) {
      setPwMsg({ ok: false, text: problem });
      return;
    }
    if (nw !== nw2) {
      setPwMsg({ ok: false, text: "Шинэ нууц үг таарахгүй байна" });
      return;
    }
    setSavingPw(true);
    try {
      const r = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: cur, next: nw }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPwMsg({ ok: false, text: d.error || "Солих боломжгүй" });
        setSavingPw(false);
        return;
      }
      setPwMsg({ ok: true, text: "Нууц үг солигдлоо. Аюулгүй байдлын үүднээс дахин нэвтэрнэ үү…" });
      setCur("");
      setNw("");
      setNw2("");
      setTimeout(() => signOut({ callbackUrl: "/login" }), 1800);
    } catch {
      setPwMsg({ ok: false, text: "Серверийн алдаа" });
      setSavingPw(false);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("mn-MN", { year: "numeric", month: "2-digit", day: "2-digit" });
  const paid = !!p.paidAt || p.role === "ADMIN";
  const chips = (
    <>
      {p.role === "ADMIN" && (
        <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          Админ
        </span>
      )}
      {paid && (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
          Эрхтэй
        </span>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-6xl px-2 sm:px-6 py-6 sm:py-8">
      <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[230px_minmax(0,1fr)_264px]">
        <aside className="hidden lg:block">
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className={cardCls}>
              <div className="flex flex-col items-center text-center">
                <Avatar name={p.name || "?"} cls="h-16 w-16 text-xl" />
                <p className="mt-3 font-semibold break-words max-w-full">{p.name || "Нэргүй"}</p>
                <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">{chips}</div>
                <dl className="mt-4 w-full space-y-1.5 text-left text-[13px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Утас</dt>
                    <dd className="break-all text-right">{p.phone || "—"}</dd>
                  </div>
                  {p.email && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-500">Имэйл</dt>
                      <dd className="break-all text-right">{p.email}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Гишүүн болсон</dt>
                    <dd>{fmtDate(p.createdAt)}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <nav className={`${cardCls} p-1.5 space-y-1`}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => changeTab(t.key)}
                  aria-pressed={tab === t.key}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                    tab === t.key
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </nav>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5 min-h-[44px]"
            >
              Гарах
            </button>
          </div>
        </aside>

        <div className="lg:hidden">
          <div className="flex items-center gap-3">
            <Avatar name={p.name || "?"} cls="h-12 w-12 text-base" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{p.name || "Нэргүй"}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {chips}
                <span className="text-[11px] text-zinc-500 truncate">
                  {p.phone || "—"} · {fmtDate(p.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <div className="sticky top-0 sm:top-[61px] z-20 -mx-2 mt-3 px-2 pt-1 pb-2 bg-white/90 backdrop-blur-xl dark:bg-[#07070c]/85">
            <div className="flex gap-1 rounded-full border border-zinc-200 bg-white/80 p-1 dark:border-white/10 dark:bg-white/5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => changeTab(t.key)}
                  aria-pressed={tab === t.key}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[12px] font-medium min-h-[36px] transition-colors ${
                    tab === t.key
                      ? "bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-1 dark:ring-inset dark:ring-indigo-400/25"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <main className="min-w-0 mt-4 lg:mt-0">
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { n: p.stats.attempts, label: "Шалгалт" },
                  { n: p.stats.avgPct !== null ? `${p.stats.avgPct}%` : "—", label: "Дундаж оноо" },
                  { n: p.stats.saved, label: "Хадгалсан хариулт" },
                  { n: p.stats.notes, label: "Тэмдэглэл" },
                ].map((t) => (
                  <div key={t.label} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:bg-white/[0.04] dark:border-white/10">
                    <p className="text-xl font-bold break-words">{t.n}</p>
                    <p className="text-xs text-zinc-500">{t.label}</p>
                  </div>
                ))}
              </div>

              <div className={cardCls}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Сүүлийн шалгалтууд</h3>
                  {p.attemptsRaw.length > 0 && (
                    <Link href="/history" className="text-xs text-indigo-600 underline dark:text-indigo-400">
                      Бүгд →
                    </Link>
                  )}
                </div>
                {p.attemptsRaw.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-500">
                    Одоогоор шалгалт өгөөгүй.{" "}
                    <Link href="/quiz" className="underline">
                      Шалгалт эхлэх
                    </Link>
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {p.attemptsRaw.slice(0, 3).map((a) => {
                      const pct = Math.round((a.score / a.total) * 100);
                      return (
                        <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2.5 dark:border-white/5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {a.score} / {a.total}
                            </p>
                            <p className="text-[11px] text-zinc-500 truncate">
                              {fmtDate(a.createdAt)} · {a.category} · {a.mode === "study" ? "Сургалт" : "Шалгалт"}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                              pct >= 60
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"
                            }`}
                          >
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Link href="/quiz" className={`${cardCls} hover:border-indigo-300 dark:hover:border-indigo-400/40 transition-colors`}>
                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Шалгалт эхлэх</p>
                </Link>
                <Link href="/history" className={`${cardCls} hover:border-indigo-300 dark:hover:border-indigo-400/40 transition-colors`}>
                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Түүх</p>
                </Link>
              </div>
            </div>
          )}

          {tab === "stats" && <ProfileStats attempts={p.attemptsRaw} totalWrong={p.mistakesWrongCount} />}

          {tab === "settings" && (
            <div className="space-y-4">
              <div className={cardCls}>
                <h3 className="font-semibold">Нэр солих</h3>
                <p className="mt-1 text-xs text-zinc-500">2–24 тэмдэгт, үсгээр эхлэх ёстой.</p>
                <form onSubmit={saveName} className="mt-3">
                  <div className="flex gap-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Таны нэр" className={`${inputCls} flex-1`} />
                    <button type="submit" disabled={savingName} className={btnCls}>
                      {savingName ? "Хадгалж байна…" : "Хадгалах"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-400">{name.length}/24</p>
                  {nameMsg && (
                    <p className={`mt-2 text-xs ${nameMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {nameMsg.text}
                    </p>
                  )}
                </form>
              </div>

              <div className={cardCls}>
                <h3 className="font-semibold">Нууц үг солих</h3>
                {!p.hasPassword ? (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Таны бүртгэлд нууц үг тохируулаагүй байна. Нэвтрэх хуудсаас «Нууц үг сэргээх»-ийг ашиглаж тохируулна уу.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-zinc-500">8–20 тэмдэгт, дор хаяж нэг тоо.</p>
                    <form onSubmit={savePw} className="mt-3 grid gap-2">
                      <label className="block">
                        <span className="text-xs text-zinc-500">Одоогийн нууц үг</span>
                        <input type="password" required value={cur} onChange={(e) => setCur(e.target.value)} className={`${inputCls} mt-1`} />
                      </label>
                      <label className="block">
                        <span className="text-xs text-zinc-500">Шинэ нууц үг</span>
                        <input type="password" required value={nw} onChange={(e) => setNw(e.target.value)} className={`${inputCls} mt-1`} />
                      </label>
                      <label className="block">
                        <span className="text-xs text-zinc-500">Шинэ нууц үг давтах</span>
                        <input type="password" required value={nw2} onChange={(e) => setNw2(e.target.value)} className={`${inputCls} mt-1`} />
                      </label>
                      <button type="submit" disabled={savingPw} className={`${btnCls} justify-self-start`}>
                        {savingPw ? "Сольж байна…" : "Нууц үг солих"}
                      </button>
                    </form>
                  </>
                )}
                {pwMsg && (
                  <p className={`mt-2 text-xs ${pwMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {pwMsg.text}
                  </p>
                )}
              </div>

              <div className={cardCls}>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5 min-h-[44px]"
                >
                  Гарах
                </button>
              </div>
            </div>
          )}
        </main>

        <aside className="hidden xl:block">
          <div className="xl:sticky xl:top-20 space-y-4">
            <div className={cardCls}>
              <h3 className="text-sm font-semibold">Энэ долоо хоног</h3>
              <dl className="mt-2 space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Шалгалт</dt>
                  <dd className="font-medium">{s.thisWeekCount}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Зарцуулсан цаг</dt>
                  <dd className="font-medium">{fmtDur(s.thisWeekTime)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Дундаж</dt>
                  <dd className="font-medium">{s.thisWeekAvgPct !== null ? `${s.thisWeekAvgPct}%` : "—"}</dd>
                </div>
              </dl>
            </div>
            <div className={cardCls}>
              <h3 className="text-sm font-semibold">Рекорд</h3>
              <dl className="mt-2 space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Шилдэг оноо</dt>
                  <dd className="font-medium">{s.bestPct !== null ? `${s.bestPct}%` : "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Цуврал</dt>
                  <dd className="font-medium">{s.streak} өдөр</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Тэнцсэн хувь</dt>
                  <dd className="font-medium">{s.passRate !== null ? `${s.passRate}%` : "—"}</dd>
                </div>
              </dl>
            </div>
            <div className={`${cardCls} space-y-1`}>
              <h3 className="text-sm font-semibold">Шуурхай</h3>
              {[
                { href: "/quiz", label: "Шалгалт эхлэх" },
                { href: "/history", label: "Түүх" },
                { href: "/calendar", label: "Календар" },
                { href: "/browse", label: "Сорилго" },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="block rounded-lg px-2 py-1.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
