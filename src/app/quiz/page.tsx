import { Suspense } from "react";
import { loadQuestions } from "@/lib/questions";
import QuizClient from "@/components/QuizClient";

export default function QuizPage() {
  const { questions } = loadQuestions();
  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="rounded-xl border p-4 text-sm">Шалгалт өгөх асуулт алга.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <Suspense fallback={<p className="py-10 text-center text-sm text-zinc-500">Ачааллаж байна…</p>}>
        <QuizClient questions={questions} />
      </Suspense>
    </div>
  );
}
