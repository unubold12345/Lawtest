import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import Header from "@/components/Header";
import PaidFlag from "@/components/PaidFlag";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://lexlab.site"),
  title: {
    default: "Хуульчийн мэргэжлийн шалгалтын сорилго — Lexlab",
    template: "%s — Lexlab",
  },
  description: "Хуульчийн мэргэжлийн шалгалтын сорилго — үндсэн ангилал, дэд ангилал, шалгалт ба сургалт.",
  appleWebApp: {
    capable: true,
    title: "Lexlab",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Хуульчийн мэргэжлийн шалгалтын сорилго",
    description: "Хуульчийн мэргэжлийн шалгалтын сорилго — үндсэн ангилал, дэд ангилал, шалгалт ба сургалт.",
    url: "/",
    siteName: "Lexlab",
    locale: "mn_MN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Хуульчийн мэргэжлийн шалгалтын сорилго",
    description: "Хуульчийн мэргэжлийн шалгалтын сорилго — үндсэн ангилал, дэд ангилал, шалгалт ба сургалт.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="mn" className={`${inter.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lexlab_theme');if(t!=='light'){document.documentElement.classList.add('dark')}var p=localStorage.getItem('lexlab_paid');if(p==='1'){document.documentElement.classList.add('lexlab-paid')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <PaidFlag />
          <Header />
          <main className="flex-1 w-full min-w-0 overflow-x-clip">{children}</main>
          <footer className="border-t border-zinc-200/80 px-2 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pt-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center dark:border-white/10">
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              © {new Date().getFullYear()} Lexlab
            </p>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
