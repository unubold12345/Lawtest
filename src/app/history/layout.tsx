import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Миний түүх",
  robots: { index: false, follow: false },
};

export default function HistoryLayout({ children }: LayoutProps<"/history">) {
  return children;
}
