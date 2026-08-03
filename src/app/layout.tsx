import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "CircleCare — Trusted childcare from your community",
  description:
    "Fast, trusted childcare from families you already share a community with. No subscriptions, no cold strangers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Providers>
          <Navbar />
          <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
