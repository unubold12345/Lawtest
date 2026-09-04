"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Question } from "@/types/question";

type Attempt = {
  id: string;
  date: string;
  category: string;
  count: number;
  mode: string;
  score: number;
  total: number;
  elapsed: number;
  answers: Record<string, number>;
  questionIds: string[];
};

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const isAuthed = !!session?.user;
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [questionsById, setQuestionsById] = useState<Record<string, Question>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [source, setSource] = useState<"db" | "local" | "">("");

  useEffect(() => {
    // fetch full questions for detail rendering
    fetch("/api/questions?full=1")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, Question> = {};
        (d.questions as Question[]).forEach((q) => (map[q.id] = q));
        setQuestionsById(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (isAuthed) {
      fetch("/api/attempts")
        .then((r) => (r.ok ? r.json() : { attempts: [] }))
        .then((d) => { setAttempts(d.attempts || []); setSource("db"); })
        .catch(() => {
          const raw = localStorage.getItem("lawtest_attempts");
          if (raw) try { setAttempts(JSON.parse(raw)); setSource("local"); } catch {}
        });
    } else {
      const raw = localStorage.getItem("lawtest_attempts");
      if (raw) try { setAttempts(JSON.parse(raw)); setSource("local"); } catch {}
      else setAttempts([]);
      setSource("local");
    }
  }, [isAuthed, status]);

  const clear = async () => {
    if (isAuthed) {
      await fetch("/api/attempts", { method: "DELETE" });
      setAttempts([]);
    } else {
      localStorage.removeItem("lawtest_attempts");
      setAttempts([]);
    }
  };

  const letters = ["A", "B", "C", "D", "E"];
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (attempts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Түүх</h1>
        <p className="mt-1 text-xs text-zinc-500">{isAuthed ? "DB-д хадгалагдана" : "Нэвтрээгүй — localStorage-д хадгалагдана"} · {source}</p>
        <p className="mt-4 rounded-xl border bg-white p-6 text-sm text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800">
          Одоогоор шалгалт өгөөгүй. <Link href="/quiz" className="underline">Шалгалт эхлэх</Link>
          {!isAuthed && <span className="block mt-2">Түүхээ хадгалахын тулд <Link href="/login" className="underline">нэвтэрнэ үү</Link>.</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Түүх — {attempts.length} оролдлого</h1>
          <p className="text-xs text-zinc-500">{source === "db" ? "DB (Prisma)" : "localStorage"} · {isAuthed ? "нэвтэрсэн" : "зочин"}</p>
        </div>
        <button onClick={clear} className="text-sm underline text-zinc-500">Цэвэрлэх</button>
      </div>

      <div className="mt-6 grid gap-4">
        {attempts.map((a) => {
          const isOpen = expanded === a.id;
          const pct = Math.round((a.score / a.total) * 100);
          return (
            <div key={a.id} className="rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden">
              <button onClick={() => setExpanded(isOpen ? null : a.id)} className="w-full p-4 flex justify-between items-center text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div>
                  <p className="font-medium">{a.score} / {a.total} · {pct}%</p>
                  <p className="text-xs text-zinc-500">{new Date(a.date).toLocaleString()} · {a.category} · {fmt(a.elapsed)} · {a.mode === "study" ? "Сургалт" : "Шалгалт"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${a.score / a.total >= 0.6 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {a.score / a.total >= 0.6 ? "Тэнцсэн" : "Унасан"}
                  </span>
                  <span className="text-sm text-zinc-400">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
                  {!a.questionIds || a.questionIds.length === 0 ? (
                    <p className="text-sm text-zinc-500">Дэлгэрэнгүй асуулт олдсонгүй (хуучин түүх).</p>
                  ) : (
                    a.questionIds.map((qid, i) => {
                      const q = questionsById[qid];
                      if (!q) return <p key={qid} className="text-sm text-zinc-500">Асуулт {qid} олдсонгүй</p>;
                      const ans = a.answers[qid];
                      const correct = typeof q.answer === "number" ? q.answer : (q.answer as number[])[0];
                      const ok = ans === correct;
                      const hasAnswer = ans !== undefined;
                      return (
                        <div key={qid} className={`rounded-2xl border p-5 ${ok ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"} dark:bg-zinc-900`}>
                          <p className="text-sm flex justify-between">
                            <span>{i + 1}. {q.category}</span>
                            <span className={ok ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
                              {hasAnswer ? (ok ? "✓ Зөв" : "✗ Буруу") : "— Хариулаагүй"}
                            </span>
                          </p>
                          <p className="mt-2 font-medium leading-relaxed">{q.question}</p>
                          <div className="mt-3 grid gap-2">
                            {q.options.map((opt, oi) => (
                              <div
                                key={oi}
                                className={`rounded-xl border px-3 py-2.5 text-sm flex gap-2 items-center ${
                                  oi === correct ? "border-green-500 bg-green-100 dark:bg-green-900/50" : ""
                                } ${oi === ans && !ok ? "border-red-500 bg-red-100 dark:bg-red-900/50" : "bg-white dark:bg-zinc-800 dark:border-zinc-700"}`}
                              >
                                <span className="font-bold">{letters[oi]}.</span>
                                <span className="flex-1">{opt}</span>
                                {oi === correct && <span className="text-green-700 dark:text-green-300 text-xs font-bold">✓ Зөв</span>}
                                {oi === ans && oi !== correct && <span className="text-red-700 dark:text-red-300 text-xs">← таны сонголт</span>}
                              </div>
                            ))}
                          </div>
                          {q.explanation && <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">Тайлбар: {q.explanation}</p>}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
