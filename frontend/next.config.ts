import type { NextConfig } from "next";

// Backend is plain HTTP (no domain/SSL yet -- deferred to Phase 1), but the
// frontend is served over HTTPS on Vercel. Browsers block HTTPS pages from
// calling HTTP endpoints directly (mixed content), so route through a
// same-origin rewrite: the browser calls /api/* on this HTTPS origin, and
// Vercel proxies to the droplet server-side, which isn't subject to that
// browser restriction.
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
        // mount -- same rewrite pattern as /api/*, needed so the header
        // logo and search-box icon don't hit mixed-content blocking.
        source: "/uploads/:path*",
        destination: `${API_PROXY_TARGET}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
