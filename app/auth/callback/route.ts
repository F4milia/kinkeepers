import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logSignInEvent } from "@/lib/auth/log-sign-in-event";

// Completes the email magic-link flow. Supabase itself enforces single-use
// (a consumed code fails exchangeCodeForSession on reuse) and the 60-minute
// expiry configured in P1's auth config - this route just finishes the
// session exchange and records the outcome.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user?.email) {
      await logSignInEvent(data.user.email.toLowerCase(), "email_link", "verified");
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Expired, already-consumed, or otherwise invalid link. We don't have a
  // reliable identifier to log against here (an invalid code doesn't
  // decode to an email) - the send-side "sent" event already covers the
  // audit trail for this attempt.
  return NextResponse.redirect(`${origin}/sign-in?error=link_invalid`);
}
