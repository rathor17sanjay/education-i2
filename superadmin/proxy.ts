import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed middleware.ts -> proxy.ts. This is a UX gate only: it
// keeps a logged-out visitor from seeing the dashboard flash before
// redirecting, it is NOT the real authorization boundary. Every actual
// admin API call is verified server-side by verify_admin/require_superadmin
// (backend/api/auth.py) regardless of what this does.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() verifies the JWT locally against Supabase's JWKS rather
  // than calling the Auth server -- the correct/cheap check here (Supabase's
  // own guidance: never trust getSession() in server code).
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

// This whole app IS the admin dashboard -- protect everything except the
// login route itself and Next's own static/image assets.
export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
