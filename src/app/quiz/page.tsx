import { Suspense } from "react";
import { loadQuestions } from "@/lib/questions";
import QuizClient from "@/components/QuizClient";

export default function QuizPage() {
  const { questions } = loadQuestions();
  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">Шалгалт өгөх сорилго алга.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-1 sm:px-6 py-6 sm:py-8">
      <Suspense fallback={<p className="py-10 text-center text-sm text-zinc-500">Ачааллаж байна…</p>}>
        <QuizClient questions={questions} />
      </Suspense>
    </div>
  );
}
