import { Suspense } from "react";
import { buildIndex } from "@/lib/questionIndexServer";
import { loadQuestions } from "@/lib/questions";
import { refreshOverrides } from "@/lib/questionOverrides";
import type { Question } from "@/types/question";
import type { QuestionPool } from "@/lib/questionIndex";
import BrowseClient from "@/components/BrowseClient";

// Shared server view for /browse (answered) and /browse/unanswered.
export default async function BrowsePage({ pool }: { pool: QuestionPool }) {
  await refreshOverrides();
  const index = buildIndex();
  if (index.total === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">Сорилго алга. data/ хавтсыг шалгана уу.</p>
      </div>
    );
  }
  // first page of this pool is rendered server-side: no skeleton flash, no first fetch
  const want = pool === "answered" ? 1 : 0;
  const { questions } = loadQuestions();
  const byId = new Map(questions.map((q) => [q.id, q]));
  const firstPage = index.rows
    .filter((r) => r[3] === want)
    .slice(0, 20)
    .map((r) => byId.get(r[0]))
    .filter((q): q is Question => !!q);
  return (
    <div className="mx-auto max-w-6xl px-1 sm:px-6 py-4 sm:py-8">
      <div>
        <Suspense fallback={<p className="py-10 text-center text-sm text-zinc-500 min-h-[150vh]">Ачааллаж байна…</p>}>
          <BrowseClient index={index} initialItems={firstPage} pool={pool} />
        </Suspense>
      </div>
    </div>
  );
}
