"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";
import { daysSince } from "@/lib/admin/days-waiting";

export interface WaitlistGroup {
  relationship: string | null;
  careRecipientStage: string | null;
  waitingCount: number;
  daysWaiting: number;
}

/**
 * Renders P2's applicant_waitlist_summary view - "which groupings have
 * enough people waiting to open a new cohort" (A2 spec). Deliberately
 * shows the raw count and oldest wait per group and nothing more: no
 * "ready to open" threshold is named anywhere in either companion doc,
 * and inventing one would be exactly the auto-matcher/scoring judgment
 * CLAUDE.md invariant #5 reserves for a human. The reviewer sees the
 * signal and decides.
 */
export async function listWaitlistSummary(callerClient?: SupabaseClient): Promise<WaitlistGroup[]> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applicant_waitlist_summary")
    .select("relationship, care_recipient_stage, waiting_count, oldest_wait_started_at")
    .order("oldest_wait_started_at", { ascending: true, nullsFirst: false });

  if (error) throw error;

  return data.map((row) => ({
    relationship: row.relationship,
    careRecipientStage: row.care_recipient_stage,
    waitingCount: row.waiting_count,
    daysWaiting: daysSince(row.oldest_wait_started_at),
  }));
}
