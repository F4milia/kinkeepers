import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side client for Server Components, Server Actions, and Route
// Handlers. Uses the anon key and the caller's session cookies, so RLS
// still applies - this is not a privileged client. For privileged
// operations (admin-issued sign-in links, etc.) use lib/supabase/admin.ts
// instead, and only from a server-only code path.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            // Called from a Server Component render - middleware.ts already
            // refreshes the session on the request path, so this is safe
            // to ignore here.
          }
        },
      },
    },
  );
}
