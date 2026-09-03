import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logSignInEvent } from "@/lib/auth/log-sign-in-event";
import { resolveUserAndRole, roleHomePath } from "@/lib/auth/roles";

// Completes the email magic-link flow. Supabase itself enforces single-use
// (a consumed code/token_hash fails on reuse) and the 60-minute expiry
// configured in P1's auth config - this route just finishes the session
// exchange and records the outcome.
//
// No caller has ever passed `next` (every signInWithOtp call sites omits
// it) - it was dead plumbing that silently defaulted every role to "/",
// which 404s for a facilitator (no applicant row for getViewer() to find).
// `next` stays as an explicit override for a future caller that wants a
// specific landing page; absent that, the destination is resolved from
// the signed-in user's own role, same as every other role gate in this
// app - never trusted from the request itself.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const explicitNext = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user?.email) {
      await logSignInEvent(data.user.email.toLowerCase(), "email_link", "verified");
      const result = await resolveUserAndRole(supabase);
      const next = explicitNext ?? roleHomePath(result?.role ?? null);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // The admin-issued recovery link (issueAdminSignInLink) can't use the
  // PKCE `code` flow above - PKCE needs a code_verifier only the
  // originating client holds, which is impossible for an admin acting on
  // someone else's behalf. Its link carries a hashed_token instead,
  // redeemed server-side via verifyOtp - no PKCE verifier needed.
  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (!error && data.user?.email) {
      await logSignInEvent(data.user.email.toLowerCase(), "email_link", "verified");
      const result = await resolveUserAndRole(supabase);
      const next = explicitNext ?? roleHomePath(result?.role ?? null);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Expired, already-consumed, or otherwise invalid link. We don't have a
  // reliable identifier to log against here (an invalid code doesn't
  // decode to an email) - the send-side "sent" event already covers the
  // audit trail for this attempt.
  return NextResponse.redirect(`${origin}/sign-in?error=link_invalid`);
}
