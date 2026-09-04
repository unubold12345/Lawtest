export type Question = {
  id: string;
  category?: string;
  question: string;
  options: string[];
  // 0-based index for single answer, array for multiple correct
  answer: number | number[];
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
