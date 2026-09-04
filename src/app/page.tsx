import { loadQuestions } from "@/lib/questions";
import Link from "next/link";

export default function Home() {
  const { questions, sources } = loadQuestions();
  const total = questions.length;
  const cats = [...new Set(questions.map((q) => q.category).filter(Boolean))] as string[];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="rounded-2xl border bg-white p-8 dark:bg-zinc-900 dark:border-zinc-800">
        <h1 className="text-3xl font-bold">Хуулийн шалгалтад бэлд</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {total} асуулт · {cats.join(" · ")} · Бүх асуултыг үзэх эсвэл шалгалт өгөх боломжтой.
        </p>

        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-sm text-zinc-500">Нийт асуулт</p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
            <p className="text-2xl font-bold">{cats.length}</p>
            <p className="text-sm text-zinc-500">Ангилал</p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
            <p className="text-2xl font-bold">{sources.find((s) => s.file === "questions.json")?.count ?? total}</p>
            <p className="text-sm text-zinc-500">questions.json</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/browse" className="rounded-full bg-zinc-900 px-7 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
            Бүх асуулт үзэх →
          </Link>
          <Link href="/quiz" className="rounded-full border px-7 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Шалгалт эхлэх
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
        <h3 className="font-semibold">Ангилал</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {cats.map((c) => (
            <Link key={c} href={`/browse?cat=${encodeURIComponent(c)}`} className="rounded-full border px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700">
              {c} · {questions.filter((q) => q.category === c).length}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
