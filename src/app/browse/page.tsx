import { Suspense } from "react";
import { loadQuestions } from "@/lib/questions";
import BrowseClient from "@/components/BrowseClient";

export default function BrowsePage() {
  const { questions } = loadQuestions();
  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="rounded-xl border p-4 text-sm">Асуулт алга. data/ хавтсыг шалгана уу.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-6 py-4 sm:py-8">
      <h1 className="text-[18px] sm:text-2xl font-semibold">Бүх асуулт</h1>
      <p className="text-[12px] sm:text-sm text-zinc-500">Жагсаалтаас нээж үзэх · шүүлтүүрээр шалгалт өгөх · хариултгүйг нь шуурхай хадгалах боломжтой</p>
      <div className="mt-3 sm:mt-6">
        <Suspense fallback={<p className="py-10 text-center text-sm text-zinc-500">Ачааллаж байна…</p>}>
          <BrowseClient questions={questions} />
        </Suspense>
      </div>
    </div>
  );
}
