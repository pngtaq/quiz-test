import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "QuizTogether",
    template: "%s · QuizTogether",
  },
  description: "Create a room, invite your friends, and compete in real time.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span
                aria-hidden="true"
                className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white"
              >
                Q
              </span>
              QuizTogether
            </Link>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
          {children}
        </main>
        <footer className="px-4 py-6 text-center text-xs text-slate-500">
          Real-time quizzes on Cloudflare Workers &amp; Durable Objects
        </footer>
      </body>
    </html>
  );
}
