import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Script from "next/script";
import "../globals.css";
import { fetchTenantThemeServer } from "@/lib/api";

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

// Guards against a stray non-hex value in tenants.theme ever reaching a raw
// <style> tag -- theme is admin-controlled (not public input), but cheap
// insurance against a malformed value breaking the page's CSS entirely.
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

// Same guard for the GTM container ID -- it gets interpolated into a raw
// <script> src/body below, so a stray value must never contain anything
// that isn't a valid container ID shape.
const GTM_ID_RE = /^GTM-[A-Z0-9]+$/i;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await fetchTenantThemeServer();
  const primaryColor =
    theme.primary_color && HEX_COLOR_RE.test(theme.primary_color) ? theme.primary_color : null;
  const secondaryColor =
    theme.secondary_color && HEX_COLOR_RE.test(theme.secondary_color)
      ? theme.secondary_color
      : null;
  const colorOverrides = [
    primaryColor && `--color-accent: ${primaryColor};`,
    secondaryColor && `--color-secondary: ${secondaryColor};`,
  ]
    .filter(Boolean)
    .join(" ");
  const gtmId = theme.gtm_id && GTM_ID_RE.test(theme.gtm_id) ? theme.gtm_id : null;

  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      {(colorOverrides || gtmId) && (
        <head>
          {colorOverrides && (
            <style
              // Overrides globals.css's hardcoded --color-accent/--color-secondary
              // with the tenant's actual configured brand colors -- same
              // mechanism as the superadmin app's own indigo override, just
              // scoped to :root here since this app only ever renders one tenant.
              dangerouslySetInnerHTML={{
                __html: `:root { ${colorOverrides} }`,
              }}
            />
          )}
          {gtmId && (
            // Standard GTM head snippet -- see the matching <noscript> iframe
            // right after <body> below, which GTM requires as a fallback.
            <Script
              id="gtm-script"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
              }}
            />
          )}
        </head>
      )}
      <body className="min-h-full flex flex-col bg-bg text-text">
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <Header logoUrl={theme.logo_url} />
        <main className="flex-1 flex flex-col overflow-y-auto pb-40">
          {children}
        </main>
        <Footer iconUrl={theme.icon_url} brandName={theme.brand_name} />
      </body>
    </html>
  );
}
