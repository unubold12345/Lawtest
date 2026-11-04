import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Шалгалтын календар",
};

export default function CalendarLayout({ children }: LayoutProps<"/exams/lawyer/2026/calendar">) {
  return children;
}
