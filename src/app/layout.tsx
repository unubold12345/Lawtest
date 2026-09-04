import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import Header from "@/components/Header";
import { loadQuestions } from "@/lib/questions";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LawTest — Хуулийн шалгалт",
  description: "123 асуулт · Гэр бүл, Иргэний эрх зүй · Шалгалт, сургалт",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { questions } = loadQuestions();
  return (
    <html lang="mn" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <SessionProvider>
          <Header total={questions.length} />
          <main className="flex-1">{children}</main>
          <footer className="border-t py-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
            LawTest · {questions.length} асуулт · data/questions.json-ээс
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
