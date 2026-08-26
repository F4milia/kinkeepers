import { createBrowserClient } from "@supabase/ssr";

// Browser-side client. Uses the anon key; every table it touches must be
// protected by RLS, never by trusting this client to behave.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
