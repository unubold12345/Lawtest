import { loadQuestions } from "@/lib/questions";
import QuizClient from "@/components/QuizClient";

export default function QuizPage() {
  const { questions } = loadQuestions();
  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Шалгалт өгөх асуулт алга.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <QuizClient questions={questions} />
    </div>
  );
}
