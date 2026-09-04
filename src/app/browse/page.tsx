import { loadQuestions } from "@/lib/questions";
import BrowseClient from "@/components/BrowseClient";

export default function BrowsePage() {
  const { questions } = loadQuestions();
  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Асуулт алга. data/questions.json-г шалгана уу.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Бүх асуулт</h1>
      <p className="text-sm text-zinc-500">Хайх, шүүх, зөв хариулт харуулах боломжтой</p>
      <div className="mt-6">
        <BrowseClient questions={questions} />
      </div>
    </div>
  );
}
