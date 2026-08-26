import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashRequestIp } from "@/lib/auth/ip-hash";

export type SignInMethod = "email_link" | "sms_code";
export type SignInOutcome = "sent" | "verified" | "failed" | "rate_limited";

// Every sign-in attempt gets one row, regardless of outcome - this is the
// audit trail the P1 spec requires ("Log every attempt: identifier,
// method, outcome, IP hash") and what the rate limiter reads from.
export async function logSignInEvent(
  identifier: string,
  method: SignInMethod,
  outcome: SignInOutcome,
) {
  const admin = createAdminClient();
  const ipHash = await hashRequestIp();

  const { error } = await admin
    .from("sign_in_events")
    .insert({ identifier, method, outcome, ip_hash: ipHash });

  if (error) {
    // Logging failure shouldn't ever be silent - the run doc treats this
    // log as something "an outside reviewer could read", so a gap in it
    // is worth knowing about even though we don't block the sign-in flow
    // on it.
    console.error("Failed to write sign_in_events row", error);
  }
}
