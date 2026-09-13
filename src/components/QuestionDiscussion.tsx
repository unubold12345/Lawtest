"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type Comment = {
  id: string;
  questionId: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
};

export default function QuestionDiscussion({ questionId }: { questionId: string }) {
  const { data: session } = useSession();
  const isAuthed = !!session?.user;
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");

  const fetchComments = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/comments?questionId=${encodeURIComponent(questionId)}`);
      const d = await r.json();
      setComments(d.comments || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchComments();
  }, [open, questionId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const post = async () => {
    if (!content.trim()) return;
    setPosting(true);
    setErr("");
    try {
      const r = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, content }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Алдаа"); setPosting(false); return; }
      setComments((prev) => [...prev, d.comment]);
      setContent("");
    } catch { setErr("Сүлжээ алдаа"); }
    setPosting(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Устгах уу?")) return;
    const r = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (r.ok) setComments((prev) => prev.filter((c) => c.id !== id));
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setErr(""); }}
        className="rounded-full border px-3 py-1 text-[11px] sm:text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        ❝ Хэлэлцүүлэг{comments.length > 0 ? ` · ${comments.length}` : ""}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Хэлэлцүүлэг">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-4 shadow-xl sm:p-5 dark:bg-zinc-900 dark:border dark:border-zinc-700">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm sm:text-base font-semibold">❝ Хэлэлцүүлэг{comments.length > 0 ? ` · ${comments.length}` : ""}</p>
          <button onClick={() => setOpen(false)} aria-label="Хаах" className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-[13px] dark:border-zinc-700">✕</button>
        </div>
        <div className="mt-3 grid gap-2.5">
          {loading ? (
            <p className="text-[13px] sm:text-sm text-zinc-500">Ачааллаж байна...</p>
          ) : comments.length === 0 ? (
            <p className="text-[13px] sm:text-sm text-zinc-500">Одоогоор сэтгэгдэл алга — эхнийх нь та байгаарай.</p>
          ) : (
            <div className="grid gap-2 max-h-[50vh] overflow-auto pr-1">
              {comments.map((c) => (
                <div key={c.id} className="rounded-xl bg-zinc-50 border p-3 dark:bg-zinc-800 dark:border-zinc-700">
                  <div className="flex justify-between gap-2">
                    <span className="text-[11px] sm:text-xs font-medium">{c.user.name || c.user.email}</span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-400">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-[13px] sm:text-sm whitespace-pre-wrap break-words">{c.content}</p>
                  {(((session?.user as unknown as { id?: string; role?: string })?.id === c.user.id) ||
                    ((session?.user as unknown as { id?: string; role?: string })?.role === "ADMIN")) && (
                    <button onClick={() => remove(c.id)} className="mt-2 text-[11px] sm:text-xs underline text-zinc-500 min-h-[36px]">Устгах</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isAuthed ? (
            <div className="grid gap-2 border-t pt-2.5 dark:border-zinc-800">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Сорилго, тайлбар, маргаан... (≤2000)"
                rows={3}
                maxLength={2000}
                autoFocus
                className="w-full rounded-xl border px-3 py-2 text-[13px] sm:text-sm dark:bg-zinc-800 dark:border-zinc-700"
              />
              {err && <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400">{err}</p>}
              <div className="flex justify-between items-center">
                <span className="text-[11px] sm:text-xs text-zinc-400">{content.length}/2000</span>
                <button
                  onClick={post}
                  disabled={posting || !content.trim()}
                  className="rounded-full bg-zinc-900 px-5 py-2 text-[12px] sm:text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900 min-h-[36px]"
                >
                  {posting ? "…" : "Илгээх"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] sm:text-sm text-zinc-500 border-t pt-2.5 dark:border-zinc-800">
              Бичихийн тулд <Link href="/login" className="underline font-medium text-zinc-900 dark:text-white">нэвтэрнэ үү</Link> — унших нь бүх хүнд нээлттэй.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
