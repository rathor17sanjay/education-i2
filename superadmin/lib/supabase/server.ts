import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Don't cache this in a module-level variable -- always create a fresh
// client per request (Supabase's own guidance, relevant under Fluid compute
// / serverless reuse).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component -- fine as long as
            // proxy.ts is refreshing the session on every request.
          }
        },
      },
    },
  );
}
