import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client. Bypasses RLS entirely - every query issued through
// this client is trusted to enforce its own authorization by hand.
//
// The `server-only` import makes any accidental import from client
// component code a build-time error rather than a leaked secret. Never
// import this file from anything that can run in the browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
