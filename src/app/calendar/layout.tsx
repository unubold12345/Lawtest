import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Шалгалтын календар",
};

export default function CalendarLayout({ children }: LayoutProps<"/calendar">) {
  return children;
}
