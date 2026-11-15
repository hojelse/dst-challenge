import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "TheGreenDiamond", template: "%s · TheGreenDiamond" },
  description:
    "Danish climate change research from 2025, harvested from OpenAlex.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <header className="border-b">
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Image
                src="/GreenDiamondLogo.svg"
                alt=""
                width={28}
                height={22}
                unoptimized
              />
              TheGreenDiamond
            </Link>
            <nav aria-label="Main" className="flex gap-4 text-sm">
              <Link href="/" className="hover:underline">
                Search
              </Link>
              <Link href="/insights" className="hover:underline">
                Insights
              </Link>
            </nav>
          </div>
        </header>
        <main
          id="main"
          className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4"
        >
          {children}
        </main>
        <footer className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
          Danish climate change research from 2025. Data from{" "}
          <a href="https://openalex.org" className="underline">
            OpenAlex
          </a>
          .
        </footer>
      </body>
    </html>
  );
}
