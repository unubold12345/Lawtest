export type Question = {
  id: string;
  // Main category = data/<Main>/ folder name. Fallback = filename if no subfolder.
  category?: string;
  // Subcategory = file name without extension inside data/<Main>/ . e.g. data/Гэр бүл/Хүүхэд.json -> subCategory="Хүүхэд"
  subCategory?: string;
  question: string;
  options: string[];
  // 0-based index for single answer, array for multiple correct
  // null/undefined = unknown — user can set it in the UI (mock.json)
  answer?: number | number[] | null;
  explanation?: string;
  lawRef?: string;
  difficulty?: "easy" | "medium" | "hard";
  year?: number;
  tags?: string[];
};

export type QuestionsLoadResult = {
  questions: Question[];
  sources: { file: string; count: number }[];
  errors: { file: string; message: string }[];
};
