"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";
import type { DeclineReason } from "@/lib/admin/decline-reasons";

export interface QueuedApplicant {
  id: string;
  firstName: string | null;
  lastName: string | null;
  relationship: string | null;
  careRecipientStage: string | null;
  timeZone: string | null;
  referralSource: string;
  daysWaiting: number;
}

export interface DeclinedApplicant extends QueuedApplicant {
  declineReason: DeclineReason | null;
}

function daysSince(isoTimestamp: string | null): number {
  if (!isoTimestamp) return 0;
  const elapsedMs = Date.now() - new Date(isoTimestamp).getTime();
  return Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
}

// Oldest first - "someone who applied twelve days ago and heard nothing
// is a person we are failing" (A2 spec). pending_review_since, not
// created_at: it's re-stamped on reopen, so a reopened applicant's wait
// clock restarts rather than showing a stale multi-week number from
// before they were declined.
export async function listPendingReviewApplicants(
  callerClient?: SupabaseClient,
): Promise<QueuedApplicant[]> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applicants")
    .select(
      "id, first_name, last_name, relationship, care_recipient_stage, time_zone, referral_source, pending_review_since",
    )
    .eq("status", "pending_review")
    .order("pending_review_since", { ascending: true, nullsFirst: false });

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    relationship: row.relationship,
    careRecipientStage: row.care_recipient_stage,
    timeZone: row.time_zone,
    referralSource: row.referral_source,
    daysWaiting: daysSince(row.pending_review_since),
  }));
}

export async function listDeclinedApplicants(callerClient?: SupabaseClient): Promise<DeclinedApplicant[]> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applicants")
    .select(
      "id, first_name, last_name, relationship, care_recipient_stage, time_zone, referral_source, pending_review_since, decline_reason",
    )
    .eq("status", "declined")
    .order("pending_review_since", { ascending: true, nullsFirst: false });

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    relationship: row.relationship,
    careRecipientStage: row.care_recipient_stage,
    timeZone: row.time_zone,
    referralSource: row.referral_source,
    daysWaiting: daysSince(row.pending_review_since),
    declineReason: row.decline_reason,
  }));
}

export interface ApplicantDetail extends QueuedApplicant {
  status: string;
}

export async function getApplicantById(
  applicantId: string,
  callerClient?: SupabaseClient,
): Promise<ApplicantDetail | null> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applicants")
    .select(
      "id, first_name, last_name, relationship, care_recipient_stage, time_zone, referral_source, pending_review_since, status",
    )
    .eq("id", applicantId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    relationship: data.relationship,
    careRecipientStage: data.care_recipient_stage,
    timeZone: data.time_zone,
    referralSource: data.referral_source,
    daysWaiting: daysSince(data.pending_review_since),
    status: data.status,
  };
}

export type ApplicantMutationResult = { success: true } | { success: false; error: string };

export async function declineApplicantAction(
  applicantId: string,
  reason: DeclineReason,
  callerClient?: SupabaseClient,
): Promise<ApplicantMutationResult> {
  const { userId } = await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { error } = await admin.rpc("decline_applicant", {
    actor_id: userId,
    target_applicant_id: applicantId,
    reason,
  });

  if (error) return { success: false, error: "Something went wrong. Try again." };

  revalidatePath("/admin/applicants");
  return { success: true };
}

export async function reopenApplicantAction(
  applicantId: string,
  callerClient?: SupabaseClient,
): Promise<ApplicantMutationResult> {
  const { userId } = await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { error } = await admin.rpc("reopen_applicant", {
    actor_id: userId,
    target_applicant_id: applicantId,
  });

  if (error) return { success: false, error: "Something went wrong. Try again." };

  revalidatePath("/admin/applicants");
  return { success: true };
}
