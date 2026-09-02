"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";
import { notifyProgramComplete } from "@/lib/messaging/applicant-notifications";
import { notifyBestEffort } from "@/lib/messaging/notify-best-effort";

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

  // X3 message 6/7. The 20260903100000 migration's applicants cascade
  // has already run (same RPC call, same transaction) by the time this
  // reads back program name - members' own status rows already say
  // 'completed' before this notification ever fires.
  const { data: cohort } = await admin
    .from("cohorts")
    .select("programs(name)")
    .eq("id", cohortId)
    .maybeSingle();
  const programName = (cohort?.programs as unknown as { name: string } | null)?.name ?? null;

  await notifyBestEffort(
    () => notifyProgramComplete(admin, cohortId, programName),
    { cohort_id: cohortId },
  );

  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath("/admin/cohorts");
  return { success: true };
}
