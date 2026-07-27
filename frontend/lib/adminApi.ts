import { createClient } from "@/lib/supabase/client";

// Attaches the current Supabase session's access token to every
// /api/admin/* call. Relative path -- covered by the existing /api/:path*
// rewrite in next.config.ts, no separate API base URL needed.
export async function adminFetch(path: string, options: RequestInit = {}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);
  if (session) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(`/api/admin${path}`, { ...options, headers });
}
