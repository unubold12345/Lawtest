import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import Header from "@/components/Header";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://lexlab.site"),
  title: "Хуульчийн мэргэжлийн шалгалтын сорилго",
  description: "Хуульчийн мэргэжлийн шалгалтын сорилго — үндсэн ангилал, дэд ангилал, шалгалт ба сургалт.",
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
            __html: `(function(){try{var t=localStorage.getItem('lexlab_theme');if(t!=='light'){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col overscroll-y-none">
        <SessionProvider>
          <Header />
          <main className="flex-1 w-full min-w-0 overflow-x-hidden">{children}</main>
          <footer className="border-t border-zinc-200/80 px-2 py-4 sm:py-6 text-center dark:border-white/10">
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              © {new Date().getFullYear()} Lexlab
            </p>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
