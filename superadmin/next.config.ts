import type { NextConfig } from "next";

// Same backend as the student-facing frontend, same mixed-content-avoidance
// reasoning (see frontend/next.config.ts) -- backend is plain HTTP, this
// app is served over HTTPS on Vercel once deployed, so route through a
// same-origin rewrite instead of calling the backend's absolute URL
// directly from the browser.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://159.223.72.11:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
      {
        // Uploaded tenant logos/icons, served by the backend's StaticFiles
        // mount -- same rewrite pattern as /api/*, needed so the edit
        // dialog's logo/icon <img> previews don't hit mixed-content
        // blocking once this app is on HTTPS.
        source: "/uploads/:path*",
        destination: `${API_PROXY_TARGET}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
