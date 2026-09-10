"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type NoAnswerRow = { id: string; file: string; category: string; subCategory: string; question: string; optionsCount: number; answer: number | null; reason: string };

type Stats = {
  questions: { total: number; byMain: Record<string, number>; sources: { file: string; count: number }[]; noAnswer: NoAnswerRow[] };
  users: number;
  attempts: number;
  comments: number;
  saved: number;
  otps: number;
};

type UserRow = { id: string; phone: string | null; email: string; role: string; createdAt: string; _count: { attempts: number; comments: number } };

type ReportRow = { id: string; questionId: string; type: string; message: string; status: string; createdAt: string; user: { id: string; name: string | null; email: string; phone: string | null } };

const REPORT_TYPES: Record<string, string> = {
  WRONG_ANSWER: "Зөв хариулт буруу",
  WRONG_OPTIONS: "Сонголтууд буруу / дутуу",
  QUESTION_ERROR: "Асуултын текстэнд алдаа",
  OTHER: "Бусад",
};

export default function AdminClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [openReports, setOpenReports] = useState(0);
  const [reportFilter, setReportFilter] = useState<"OPEN" | "RESOLVED" | "all">("OPEN");
  const [tab, setTab] = useState<"overview" | "users" | "questions" | "attempts" | "reports">("overview");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const fetchStats = async () => {
    const r = await fetch("/api/admin/stats");
    if (!r.ok) throw new Error((await r.json()).error || "stats failed");
    setStats(await r.json());
  };
  const fetchUsers = async (search = q) => {
    const r = await fetch(`/api/admin/users?q=${encodeURIComponent(search)}`);
    if (!r.ok) throw new Error("users failed");
    const d = await r.json();
    setUsers(d.users);
  };
  const fetchAttempts = async () => {
    const r = await fetch("/api/admin/attempts");
    if (!r.ok) throw new Error("attempts failed");
    const d = await r.json();
    setAttempts(d.attempts);
  };
  const fetchReports = async (f = reportFilter) => {
    const r = await fetch(`/api/admin/reports?status=${f === "all" ? "" : f}`);
    if (!r.ok) throw new Error("reports failed");
    const d = await r.json();
    setReports(d.reports);
    setOpenReports(d.open);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([fetchStats(), fetchUsers(""), fetchAttempts(), fetchReports("OPEN")]);
      } catch (e: any) {
        setErr(e.message || "Алдаа");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setReportStatus = async (id: string, status: "OPEN" | "RESOLVED") => {
    const r = await fetch(`/api/admin/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!r.ok) { alert("Амжилтгүй"); return; }
    if (reportFilter === "all") {
      setReports((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
    } else {
      setReports((prev) => prev.filter((x) => x.id !== id));
    }
    setOpenReports((n) => n + (status === "RESOLVED" ? -1 : 1));
  };
  const delReport = async (id: string) => {
    if (!confirm("Мэдээллийг устгах уу?")) return;
    const r = await fetch(`/api/admin/reports/${id}`, { method: "DELETE" });
    if (!r.ok) { alert("Амжилтгүй"); return; }
    setReports((prev) => {
      const gone = prev.find((x) => x.id === id);
      if (gone?.status === "OPEN") setOpenReports((n) => Math.max(0, n - 1));
      return prev.filter((x) => x.id !== id);
    });
  };

  const toggleRole = async (u: UserRow) => {
    const next = u.role === "ADMIN" ? "USER" : "ADMIN";
    if (!confirm(`${u.phone || u.email} → ${next} болгох уу?`)) return;
    const r = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, role: next }) });
    if (!r.ok) { alert("Амжилтгүй"); return; }
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: next } : x)));
  };
  const delUser = async (u: UserRow) => {
    if (!confirm(`${u.phone || u.email} устгах уу?`)) return;
    const r = await fetch(`/api/admin/users?id=${u.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); alert(d.error || "Устгаж чадсангүй"); return; }
    setUsers((prev) => prev.filter((x) => x.id !== u.id));
  };

  if (loading) return <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8"><p className="text-sm text-zinc-500">Ачаалж байна…</p></div>;
  if (err) return <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8"><p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p></div>;

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Админ</h1>
        <div className="flex gap-2 text-xs">
          <Link href="/" className="rounded-full border px-4 py-2 hover:bg-zinc-50 dark:border-zinc-700">Нүүр</Link>
          <Link href="/browse" className="rounded-full border px-4 py-2 hover:bg-zinc-50 dark:border-zinc-700">Асуулт</Link>
        </div>
      </div>

      {/* stats cards */}
      {stats && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800"><p className="text-2xl font-bold">{stats.questions.total}</p><p className="text-xs text-zinc-500">Асуулт</p></div>
          <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800"><p className="text-2xl font-bold">{stats.users}</p><p className="text-xs text-zinc-500">Хэрэглэгч</p></div>
          <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800"><p className="text-2xl font-bold">{stats.attempts}</p><p className="text-xs text-zinc-500">Оролдлого</p></div>
          <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800"><p className="text-2xl font-bold">{stats.comments}</p><p className="text-xs text-zinc-500">Сэтгэгдэл</p></div>
          <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800"><p className="text-2xl font-bold">{stats.saved}</p><p className="text-xs text-zinc-500">Хадгалсан хариу</p></div>
          <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800"><p className="text-2xl font-bold">{stats.otps}</p><p className="text-xs text-zinc-500">OTP</p></div>
        </div>
      )}

      {/* tabs */}
      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
        {[
          ["overview", "Тойм"],
          ["users", "Хэрэглэгчид"],
          ["questions", "Асуултууд"],
          ["attempts", "Оролдлогууд"],
          ["reports", `Мэдээлэл${openReports > 0 ? ` (${openReports})` : ""}`],
        ].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id as any); if (id === "reports") fetchReports(); }} className={`shrink-0 rounded-full px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-medium border min-h-[40px] ${tab === id ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700"}`}>{label}</button>
        ))}
      </div>

      {tab === "overview" && stats && (
        <div className="mt-4 grid gap-4">
          <div className="rounded-2xl border bg-white p-4 sm:p-5 dark:bg-zinc-900 dark:border-zinc-800">
            <h3 className="font-semibold text-sm">Ангиллаар (main)</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(stats.questions.byMain).sort((a,b)=>collator.compare(a[0],b[0])).map(([k,v])=>(
                <div key={k} className="flex justify-between rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800"><span className="truncate pr-2">{k}</span><b>{v}</b></div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-4 sm:p-5 dark:bg-zinc-900 dark:border-zinc-800">
            <h3 className="font-semibold text-sm">Файл / эх сурвалж</h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead><tr className="text-zinc-500"><th className="text-left py-2">Файл</th><th className="text-right py-2">Тоо</th></tr></thead>
                <tbody>
                  {stats.questions.sources.sort((a,b)=>collator.compare(a.file,b.file)).map(s=>(
                    <tr key={s.file} className="border-t dark:border-zinc-800"><td className="py-2 pr-2 break-all">{s.file}</td><td className="py-2 text-right">{s.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="mt-4 rounded-2xl border bg-white p-4 sm:p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') fetchUsers(); }} placeholder="Хайх: утас / имэйл" className="flex-1 rounded-xl border px-4 py-3 sm:py-2.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-[44px]" />
            <button onClick={()=>fetchUsers()} className="rounded-full bg-zinc-900 px-5 py-3 sm:py-2.5 text-sm text-white dark:bg-white dark:text-zinc-900 min-h-[44px]">Хайх</button>
          </div>
          <div className="mt-4 hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-zinc-500 text-xs"><th className="text-left py-2">Утас / Имэйл</th><th className="text-left py-2">Role</th><th className="text-left py-2">Бүртгүүлсэн</th><th className="text-left py-2">Шалгалт / Сэтгэгдэл</th><th className="text-right py-2">Үйлдэл</th></tr></thead>
              <tbody>
                {users.map(u=>(
                  <tr key={u.id} className="border-t dark:border-zinc-800">
                    <td className="py-2"><div className="font-mono text-xs">{u.phone || "—"}</div><div className="text-xs text-zinc-500 truncate max-w-[220px]">{u.email}</div></td>
                    <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role==='ADMIN' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30' : 'bg-zinc-100 dark:bg-zinc-800'}`}>{u.role}</span></td>
                    <td className="py-2 text-xs text-zinc-500">{new Date(u.createdAt).toLocaleDateString("mn-MN")}</td>
                    <td className="py-2 text-xs">{u._count.attempts} / {u._count.comments}</td>
                    <td className="py-2 text-right flex gap-1 justify-end">
                      <button onClick={()=>toggleRole(u)} className="rounded-full border px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700">{u.role==='ADMIN' ? 'USER болгох' : 'ADMIN болгох'}</button>
                      <button onClick={()=>delUser(u)} className="rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">Устгах</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-2 sm:hidden">
            {users.map(u=>(
              <div key={u.id} className="rounded-xl border p-3 dark:border-zinc-700">
                <div className="flex justify-between gap-2"><span className="font-mono text-xs truncate">{u.phone || u.email}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${u.role==='ADMIN'?'bg-violet-100 text-violet-700':'bg-zinc-100 dark:bg-zinc-800'}`}>{u.role}</span></div>
                <p className="text-xs text-zinc-500 break-all">{u.email}</p>
                <p className="text-xs text-zinc-500 mt-1">{new Date(u.createdAt).toLocaleDateString("mn-MN")} · {u._count.attempts} шалгалт · {u._count.comments} сэтгэгдэл</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={()=>toggleRole(u)} className="flex-1 rounded-full border py-2 text-xs dark:border-zinc-700 min-h-[40px]">{u.role==='ADMIN' ? 'USER болгох' : 'ADMIN болгох'}</button>
                  <button onClick={()=>delUser(u)} className="rounded-full border border-red-200 px-4 py-2 text-xs text-red-600 min-h-[40px]">Устгах</button>
                </div>
              </div>
            ))}
            {users.length===0 && <p className="text-sm text-zinc-500 text-center py-6">Хэрэглэгч алга</p>}
          </div>
        </div>
      )}

      {tab === "questions" && stats && (
        <div className="mt-4 grid gap-4">
        {(stats.questions.noAnswer?.length || 0) > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5 dark:bg-red-950/20 dark:border-red-900">
            <h3 className="font-semibold text-sm text-red-800 dark:text-red-200">Хариултгүй / буруу хариулттай асуулт ({stats.questions.noAnswer.length})</h3>
            <p className="mt-1 text-xs text-red-600 dark:text-red-300">Эдгээр нь шалгалтад оноо өгөхгүй — JSON файл дээр нь засаарай.</p>
            <div className="mt-3 space-y-2">
              {stats.questions.noAnswer.map((r) => (
                <div key={`${r.file}::${r.id}`} className="rounded-xl border border-red-200 bg-white p-3 dark:bg-zinc-900 dark:border-red-900">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white">{r.reason}</span>
                    <span className="font-mono text-[10px] text-zinc-500">{r.id} · {r.optionsCount} сонголт</span>
                  </div>
                  <p className="mt-1.5 text-[13px] font-medium leading-snug break-words">{r.question}</p>
                  <p className="mt-1 text-[11px] text-zinc-500 break-all">{r.file}{r.subCategory ? ` · ${r.subCategory}` : ""}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-2xl border bg-white p-4 sm:p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Нийт {stats.questions.total} асуулт. Жагсаалтыг дэлгэрэнгүй харах бол <Link href="/browse" className="underline">Бүх асуулт</Link> руу орно уу. Доор файл тус бүрээр харуулав.</p>
          <div className="mt-3 space-y-2">
            {stats.questions.sources.sort((a,b)=>collator.compare(a.file,b.file)).map(s=>(
              <div key={s.file} className="flex justify-between gap-2 rounded-xl border px-3 py-2 text-sm dark:border-zinc-700"><span className="break-all">{s.file}</span><b className="shrink-0">{s.count}</b></div>
            ))}
          </div>
        </div>
        </div>
      )}

      {tab === "reports" && (
        <div className="mt-4 rounded-2xl border bg-white p-4 sm:p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">Хэрэглэгчдийн мэдээлсэн алдаа{openReports > 0 ? ` · ${openReports} нээлттэй` : ""}</h3>
            <div className="flex gap-1.5">
              {(["OPEN", "RESOLVED", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setReportFilter(f); fetchReports(f); }}
                  className={`rounded-full border px-3 py-1.5 text-[11px] sm:text-xs min-h-[32px] ${reportFilter === f ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "dark:border-zinc-700"}`}
                >
                  {f === "OPEN" ? "Нээлттэй" : f === "RESOLVED" ? "Шийдэгдсэн" : "Бүгд"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border p-3 dark:border-zinc-700">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.status === "OPEN" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                      {r.status === "OPEN" ? "Нээлттэй" : "Шийдэгдсэн"}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] dark:bg-zinc-800">{REPORT_TYPES[r.type] || r.type}</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500 break-all">{r.questionId}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-snug break-words whitespace-pre-wrap">{r.message}</p>
                <p className="mt-1 text-[11px] text-zinc-500">{r.user?.phone || r.user?.name || r.user?.email} · {new Date(r.createdAt).toLocaleString("mn-MN")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.status === "OPEN" ? (
                    <button onClick={() => setReportStatus(r.id, "RESOLVED")} className="rounded-full bg-zinc-900 px-4 py-1.5 text-[11px] sm:text-xs text-white dark:bg-white dark:text-zinc-900 min-h-[32px]">Шийдэгдсэн болгох</button>
                  ) : (
                    <button onClick={() => setReportStatus(r.id, "OPEN")} className="rounded-full border px-4 py-1.5 text-[11px] sm:text-xs dark:border-zinc-700 min-h-[32px]">Дахин нээх</button>
                  )}
                  <button onClick={() => delReport(r.id)} className="rounded-full border px-4 py-1.5 text-[11px] sm:text-xs dark:border-zinc-700 min-h-[32px]">Устгах</button>
                </div>
              </div>
            ))}
            {reports.length === 0 && <p className="text-sm text-zinc-500 text-center py-6">Мэдээлэл алга</p>}
          </div>
        </div>
      )}

      {tab === "attempts" && (
        <div className="mt-4 rounded-2xl border bg-white p-4 sm:p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <h3 className="font-semibold text-sm">Сүүлийн оролдлогууд</h3>
          <div className="mt-3 overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-zinc-500"><th className="text-left py-2">Хэрэглэгч</th><th className="text-left py-2">Ангилал</th><th className="text-left py-2">Оноо</th><th className="text-left py-2">Огноо</th></tr></thead>
              <tbody>
                {attempts.map((a:any)=>(
                  <tr key={a.id} className="border-t dark:border-zinc-800">
                    <td className="py-2 font-mono text-xs">{a.user?.phone || a.user?.email}</td>
                    <td className="py-2 text-xs">{a.category} · {a.mode}</td>
                    <td className="py-2 text-xs">{a.score}/{a.total}</td>
                    <td className="py-2 text-xs text-zinc-500">{new Date(a.createdAt).toLocaleString("mn-MN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid gap-2 sm:hidden">
            {attempts.map((a:any)=>(
              <div key={a.id} className="rounded-xl border p-3 text-sm dark:border-zinc-700">
                <div className="flex justify-between"><span className="font-mono text-xs">{a.user?.phone || a.user?.email}</span><b className="text-xs">{a.score}/{a.total}</b></div>
                <p className="text-xs text-zinc-500">{a.category} · {a.mode} · {new Date(a.createdAt).toLocaleString("mn-MN")}</p>
              </div>
            ))}
            {attempts.length===0 && <p className="text-sm text-zinc-500 text-center py-6">Оролдлого алга</p>}
          </div>
        </div>
      )}
    </div>
  );
}
