import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Nunito, Geist_Mono } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aprise — You apply. You rise. You aprise.",
  description:
    "AI-powered job application tracker. Get stage-aware coaching, track every application, and prep for every interview.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${nunito.variable} ${geistMono.variable}`}>
        <body className="antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
