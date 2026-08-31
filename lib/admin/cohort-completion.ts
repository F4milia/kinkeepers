"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";

export type CohortMutationResult = { success: true } | { success: false; error: string };

/**
 * Plain reviewer action, never automatic - CLAUDE.md invariant #11
 * ("payout release is never automatic ... a reviewer releases") and
 * invariant #12 (no completion celebration) both apply here: nothing in
 * this codebase watches session status to auto-detect "the cohort is
 * done," and this action doesn't add such a check either.
 */
export async function markCohortCompletedAction(
  cohortId: string,
  callerClient?: SupabaseClient,
): Promise<CohortMutationResult> {
  const { userId } = await requireRole(["admin"], callerClient);
  const admin = createAdminClient();

  const { error } = await admin.rpc("mark_cohort_completed", {
    actor_id: userId,
    target_cohort_id: cohortId,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath("/admin/cohorts");
  return { success: true };
}
