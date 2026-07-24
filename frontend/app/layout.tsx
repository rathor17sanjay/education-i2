import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Stand-in for BMU's proprietary "Amplitude" typeface (Light/Regular/Bold) --
// same weight range, similar rounded geometric character, but legally ours
// to bundle since it's open-licensed.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "CampusAI",
  description: "AI Admissions Counsellor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-text">
        <Header />
        <main className="flex-1 flex flex-col overflow-y-auto pb-40">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
