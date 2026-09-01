"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ForbiddenError } from "@/lib/auth/roles";
import type { AttendanceStatus } from "@/lib/types";

export type SessionLogMutationResult = { success: true } | { success: false; error: string };

export interface AttendanceEntry {
  applicantId: string;
  /** "unmarked" is never sent - it means "no row," not a status to write. */
  status: Exclude<AttendanceStatus, "unmarked">;
}

/**
 * The real write path behind FacilitatorSessionLog - X4's own prerequisite
 * (see the migration's header comment: nothing in the run doc ever
 * explicitly assigned "build a real attendance-confirmation backend" to a
 * session). requireRole gates broadly (facilitator or admin); the
 * ownership check below scopes it to the specific session, same
 * two-layer division of responsibility as every other admin/facilitator
 * mutation in this codebase (Server Action checks, the RPC trusts
 * actor_id).
 */
export async function submitSessionLogAction(
  sessionId: string,
  deliveryConfirmed: boolean,
  notes: string,
  attendance: AttendanceEntry[],
  callerClient?: SupabaseClient,
): Promise<SessionLogMutationResult> {
  const { userId, role } = await requireRole(["facilitator", "admin"], callerClient);
  const admin = createAdminClient();

  if (role !== "admin") {
    const { data: session, error } = await admin
      .from("sessions")
      .select("cohort_id, substitute_facilitator_id, cohorts(facilitator_id)")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!session) return { success: false, error: "Session not found." };

    const cohortFacilitatorId = (session.cohorts as unknown as { facilitator_id: string | null } | null)?.facilitator_id;
    const isOwner = cohortFacilitatorId === userId || session.substitute_facilitator_id === userId;
    if (!isOwner) throw new ForbiddenError(role, ["admin"]);
  }

  const { error } = await admin.rpc("submit_session_log", {
    actor_id: userId,
    target_session_id: sessionId,
    delivery_confirmed: deliveryConfirmed,
    notes: notes.trim() ? notes : null,
    attendance: attendance.map((entry) => ({ applicant_id: entry.applicantId, status: entry.status })),
  });
  if (error) return { success: false, error: error.message };

  revalidatePath(`/session/${sessionId}`);
  revalidatePath("/facilitator/schedule");
  return { success: true };
}
