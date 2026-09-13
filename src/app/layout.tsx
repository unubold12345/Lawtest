import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import Header from "@/components/Header";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lexlab — Хуулийн шалгалт",
  description: "123 сорилго · Гэр бүл, Иргэний эрх зүй · Шалгалт, сургалт",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
          <footer className="border-t px-2 py-4 sm:py-6 text-center dark:border-zinc-800">
            <p className="flex items-center justify-center gap-1.5 text-sm font-extrabold tracking-tighter text-zinc-900 dark:text-zinc-100">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-bold leading-none text-white dark:bg-white dark:text-zinc-900">§</span>
              Lex<span className="font-medium">lab</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              © {new Date().getFullYear()} Lexlab · Бүх эрх хуулиар хамгаалагдсан
            </p>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
