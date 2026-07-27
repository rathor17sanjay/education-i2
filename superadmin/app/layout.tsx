import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GT CampusAI Superadmin",
  description: "Platform-wide tenant onboarding and management",
};

// Dark-only, always -- an admin ops tool doesn't need a light/dark toggle.
// Kept minimal (no sidebar here) since /login also uses this root layout
// and shouldn't show the dashboard nav; the (dashboard) route group adds
// its own nested layout with the sidebar.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
