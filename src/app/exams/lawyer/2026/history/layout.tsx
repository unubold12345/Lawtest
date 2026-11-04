import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Шалгалтын түүх",
  robots: { index: false, follow: false },
};

export default function HistoryLayout({ children }: LayoutProps<"/exams/lawyer/2026/history">) {
  return children;
}
