import { createClient } from "@/lib/supabase/client";

// Attaches the current Supabase session's access token to an /api/* call.
// Callers pass the full path including which router they're hitting --
// /admin/me (generic whoami, either admin tier) or /superadmin/... (
// platform-only routes) -- since this app talks to both. Relative path,
// covered by the existing /api/:path* rewrite in next.config.ts.
export async function adminFetch(path: string, options: RequestInit = {}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);
  if (session) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(`/api${path}`, { ...options, headers });
}
