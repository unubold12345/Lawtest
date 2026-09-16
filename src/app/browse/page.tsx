import { Suspense } from "react";
import { buildIndex } from "@/lib/questionIndexServer";
import { loadQuestions } from "@/lib/questions";
import BrowseClient from "@/components/BrowseClient";

export default function BrowsePage() {
  const index = buildIndex();
  if (index.total === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">Сорилго алга. data/ хавтсыг шалгана уу.</p>
      </div>
    );
  }
  // first page of the default (unfiltered) view is rendered server-side: no skeleton flash, no first fetch
  const firstPage = loadQuestions().questions.slice(0, 20);
  return (
    <div className="mx-auto max-w-6xl px-1 sm:px-6 py-4 sm:py-8">
      <div>
        <Suspense fallback={<p className="py-10 text-center text-sm text-zinc-500 min-h-[150vh]">Ачааллаж байна…</p>}>
          <BrowseClient index={index} initialItems={firstPage} />
        </Suspense>
      </div>
    </div>
  );
}
