"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type UnsubscribeResult = { success: true } | { success: false; error: string };

/**
 * Public, token-based - no signed-in session required (a caregiver
 * clicking a link in their email isn't necessarily signed in). The
 * token, not the caller's identity, is what authorizes this - same
 * boundary lib/referral/data.ts's resolveApplicantByResumeToken already
 * establishes for the intake-resume flow.
 *
 * status/cohort_id (real enrollment) are never touched here - see
 * notification_log_and_unsubscribe.sql's own comment: "stops delivery
 * without removing enrollment" means exactly this column and nothing
 * else changes.
 */
export async function unsubscribeFromNotifications(token: string): Promise<UnsubscribeResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applicants")
    .update({ notifications_opted_out: true })
    .eq("notification_unsubscribe_token", token)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: "Something went wrong. Try again." };
  if (!data) return { success: false, error: "This link isn't working." };

  return { success: true };
}
