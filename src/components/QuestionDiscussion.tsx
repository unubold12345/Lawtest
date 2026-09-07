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

  return (
    <div className="mt-4 rounded-xl border bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
      >
        <span>Хэлэлцүүлэг {comments.length > 0 ? `· ${comments.length}` : ""}</span>
        <span className="text-xs text-zinc-500">{open ? "Нуух ▲" : "Нээх ▼"}</span>
      </button>
      {open && (
        <div className="border-t px-4 py-4 space-y-3 dark:border-zinc-800">
          {loading ? (
            <p className="text-sm text-zinc-500">Ачааллаж байна...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-zinc-500">Одоогоор сэтгэгдэл алга — эхнийх нь та байгаарай.</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-auto pr-1">
              {comments.map((c) => (
                <div key={c.id} className="rounded-xl bg-white border p-3 dark:bg-zinc-800 dark:border-zinc-700">
                  <div className="flex justify-between gap-2">
                    <span className="text-xs font-medium">{c.user.name || c.user.email}</span>
                    <span className="text-[11px] text-zinc-400">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{c.content}</p>
                  {(session?.user as unknown as { id?: string })?.id === c.user.id && (
                    <button onClick={() => remove(c.id)} className="mt-2 text-xs underline text-zinc-500">Устгах</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isAuthed ? (
            <div className="pt-2 space-y-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Асуулт, тайлбар, маргаан... (≤2000)"
                rows={3}
                maxLength={2000}
                className="w-full rounded-xl border px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700"
              />
              {err && <p className="text-xs text-red-600">{err}</p>}
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">{content.length}/2000</span>
                <button
                  onClick={post}
                  disabled={posting || !content.trim()}
                  className="rounded-full bg-zinc-900 px-5 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
                >
                  {posting ? "..." : "Илгээх"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              Бичихийн тулд <Link href="/login" className="underline">нэвтэрнэ үү</Link> — унших нь бүх хүнд нээлттэй.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
