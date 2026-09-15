import { Suspense } from "react";
import { loadQuestions } from "@/lib/questions";
import BrowseClient from "@/components/BrowseClient";

export default function BrowsePage() {
  const { questions } = loadQuestions();
  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">Сорилго алга. data/ хавтсыг шалгана уу.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-1 sm:px-6 py-4 sm:py-8">
      <div>
        <Suspense fallback={<p className="py-10 text-center text-sm text-zinc-500">Ачааллаж байна…</p>}>
          <BrowseClient questions={questions} />
        </Suspense>
      </div>
    </div>
  );
}
