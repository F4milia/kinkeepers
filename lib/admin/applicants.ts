"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";
import type { DeclineReason } from "@/lib/admin/decline-reasons";
import { daysSince } from "@/lib/admin/days-waiting";

export interface QueuedApplicant {
  id: string;
  firstName: string | null;
  lastName: string | null;
  relationship: string | null;
  careRecipientStage: string | null;
  timeZone: string | null;
  referralSource: string;
  daysWaiting: number;
  availabilityWindows: string[];
}

// availability_windows is stored as a plain jsonb string array (see
// lib/referral/actions.ts's saveIntakeProgress) - narrowed the same way
// the intake form's own asStringArray() does, since Postgres returns it
// as unknown until validated.
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export interface DeclinedApplicant extends QueuedApplicant {
  declineReason: DeclineReason | null;
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
      "id, first_name, last_name, relationship, care_recipient_stage, time_zone, referral_source, pending_review_since, availability_windows",
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
    availabilityWindows: asStringArray(row.availability_windows),
  }));
}

export async function listDeclinedApplicants(callerClient?: SupabaseClient): Promise<DeclinedApplicant[]> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applicants")
    .select(
      "id, first_name, last_name, relationship, care_recipient_stage, time_zone, referral_source, pending_review_since, decline_reason, availability_windows",
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
    availabilityWindows: asStringArray(row.availability_windows),
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
      "id, first_name, last_name, relationship, care_recipient_stage, time_zone, referral_source, pending_review_since, status, availability_windows",
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
    availabilityWindows: asStringArray(data.availability_windows),
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

/**
 * P5: withdraw_applicant() and the member_dropped analytics event it
 * writes (see the analytics_events migration) - built as part of P5
 * because member_dropped had no real trigger at all beforehand, not
 * because a withdraw feature was named in P5's own scope. No admin UI
 * calls this yet - P5's prompt is explicitly "views or functions, not a
 * dashboard," and no session in the run doc currently owns a "withdraw a
 * member" screen. Flagging that gap here rather than inventing UI scope
 * beyond what was asked.
 */
export async function withdrawApplicantAction(
  applicantId: string,
  reason: string | null,
  callerClient?: SupabaseClient,
): Promise<ApplicantMutationResult> {
  const { userId } = await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { error } = await admin.rpc("withdraw_applicant", {
    actor_id: userId,
    target_applicant_id: applicantId,
    reason,
  });

  if (error) return { success: false, error: "Something went wrong. Try again." };

  revalidatePath("/admin/applicants");
  return { success: true };
}
