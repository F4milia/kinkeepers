import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Refreshes the auth session on every request that isn't a static asset.
// This is what makes "rolling refresh on activity" real: without it,
// Server Components see a stale/expired access token and every visit
// would look like a fresh, unauthenticated request.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not remove: this call is what actually triggers the refresh and
  // re-issues cookies. Do not add logic between this and returning the
  // response, and do not swap this for a lighter-weight session check -
  // see the Supabase SSR docs on why (session desync bugs are a known
  // failure mode when this call is skipped or reordered).
  await supabase.auth.getUser();

  return supabaseResponse;
}
