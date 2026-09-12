import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import Header from "@/components/Header";
import { loadQuestions } from "@/lib/questions";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lexlab — Хуулийн шалгалт",
  description: "123 асуулт · Гэр бүл, Иргэний эрх зүй · Шалгалт, сургалт",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { questions } = loadQuestions();
  return (
    <html lang="mn" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lexlab_theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 overscroll-y-none">
        <SessionProvider>
          <Header />
          <main className="flex-1 w-full min-w-0 overflow-x-hidden">{children}</main>
          <footer className="border-t py-4 sm:py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 px-4">
            Lexlab · {questions.length} асуулт · data/ файлуудаас
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
