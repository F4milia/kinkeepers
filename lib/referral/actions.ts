"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";
import { sendResumeEmail } from "@/lib/referral/send-resume-email";
import { notifyApplicationReceived } from "@/lib/messaging/applicant-notifications";
import { notifyBestEffort } from "@/lib/messaging/notify-best-effort";

const MAX_PARTNER_REFERENCE_ID_LENGTH = 64;

export type CreateReferralResult =
  | { success: true; applicantId: string; resumeToken: string }
  | { success: false; reason: "partner_not_found" | "invalid_partner_reference_id" | "forbidden" };

function isValidPartnerReferenceId(value: string | undefined): boolean {
  return value === undefined || value.length <= MAX_PARTNER_REFERENCE_ID_LENGTH;
}

/**
 * Referral path 1: the shareable partner-scoped link, completed by the
 * caregiver themselves. Unauthenticated - the only gate is that the
 * slug has to resolve to a real partner organization.
 */
export async function createSelfReferral(
  partnerSlug: string,
  partnerReferenceId?: string,
): Promise<CreateReferralResult> {
  if (!isValidPartnerReferenceId(partnerReferenceId)) {
    return { success: false, reason: "invalid_partner_reference_id" };
  }

  const admin = createAdminClient();

  const { data: partner } = await admin
    .from("partner_organizations")
    .select("id")
    .eq("referral_link_slug", partnerSlug)
    .maybeSingle();

  if (!partner) {
    return { success: false, reason: "partner_not_found" };
  }

  const { data, error } = await admin
    .from("applicants")
    .insert({
      partner_organization_id: partner.id,
      referral_source: "partner_link",
      partner_reference_id: partnerReferenceId ?? null,
    })
    .select("id, resume_token")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create self-referral");
  }

  return { success: true, applicantId: data.id, resumeToken: data.resume_token };
}

/**
 * Referral path 2: a care navigator (partner_staff) submits on the
 * caregiver's behalf. Scoped to the navigator's own organization -
 * there's no way to submit for a different partner than the one the
 * caller actually belongs to.
 *
 * `callerClient` is optional and exists for testability, threaded
 * straight through to requireRole() - see lib/auth/roles.ts.
 */
export async function createStaffReferral(
  partnerReferenceId: string | undefined,
  callerClient?: SupabaseClient,
): Promise<CreateReferralResult> {
  if (!isValidPartnerReferenceId(partnerReferenceId)) {
    return { success: false, reason: "invalid_partner_reference_id" };
  }

  const { userId } = await requireRole(["partner_staff"], callerClient);

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("partner_organization_id")
    .eq("id", userId)
    .single();

  if (!profile?.partner_organization_id) {
    return { success: false, reason: "forbidden" };
  }

  const { data, error } = await admin
    .from("applicants")
    .insert({
      partner_organization_id: profile.partner_organization_id,
      referral_source: "staff_form",
      partner_reference_id: partnerReferenceId ?? null,
    })
    .select("id, resume_token")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create staff referral");
  }

  return { success: true, applicantId: data.id, resumeToken: data.resume_token };
}

// Ten fields max per the P2 spec (9 intake fields here; referral_source
// and partner_reference_id are set at creation, not editable via this
// path). All optional - only the keys actually present get written, so
// a partial save never clobbers a field the caller didn't touch with an
// accidental undefined/null.
export interface IntakeFieldsUpdate {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  timeZone?: string;
  relationship?: string;
  careRecipientStage?: "early" | "middle" | "late" | "unsure";
  availabilityWindows?: unknown;
  preferredContactChannel?: "email" | "sms" | "both";
}

export type SaveIntakeProgressResult = { success: true } | { success: false; reason: "not_found" };

/**
 * Partial-save, called on every field blur (L2's spec) as the multi-step
 * form fills in. Identified by resume_token, not an authenticated
 * session - there isn't one at this point in the flow.
 *
 * Fires the resume-link email exactly once: only on the specific save
 * where email transitions from absent to present, never on saves after
 * that (which would resend it on every subsequent field blur).
 */
export async function saveIntakeProgress(
  resumeToken: string,
  fields: IntakeFieldsUpdate,
): Promise<SaveIntakeProgressResult> {
  const admin = createAdminClient();

  const { data: current, error: fetchError } = await admin
    .from("applicants")
    .select("id, email")
    .eq("resume_token", resumeToken)
    .maybeSingle();

  if (fetchError || !current) {
    return { success: false, reason: "not_found" };
  }

  const dbFields: Record<string, unknown> = {};
  if (fields.firstName !== undefined) dbFields.first_name = fields.firstName;
  if (fields.lastName !== undefined) dbFields.last_name = fields.lastName;
  if (fields.email !== undefined) dbFields.email = fields.email;
  if (fields.phone !== undefined) dbFields.phone = fields.phone;
  if (fields.timeZone !== undefined) dbFields.time_zone = fields.timeZone;
  if (fields.relationship !== undefined) dbFields.relationship = fields.relationship;
  if (fields.careRecipientStage !== undefined) dbFields.care_recipient_stage = fields.careRecipientStage;
  if (fields.availabilityWindows !== undefined) dbFields.availability_windows = fields.availabilityWindows;
  if (fields.preferredContactChannel !== undefined) {
    dbFields.preferred_contact_channel = fields.preferredContactChannel;
  }

  const { error: updateError } = await admin.from("applicants").update(dbFields).eq("id", current.id);
  if (updateError) throw updateError;

  const emailJustProvided = !current.email && fields.email;
  if (emailJustProvided) {
    await sendResumeEmail(fields.email!, resumeToken, current.id);
  }

  return { success: true };
}

export type CompleteIntakeResult = { success: true } | { success: false; reason: "not_found" };

// Transitions referred -> intake_complete. The status change itself is
// what the applicants_log_status_event trigger (P2 PR2) picks up
// automatically - this just performs the update. As of A2 (Wave 3), a
// second trigger (applicants_z_advance_intake_complete) immediately
// cascades intake_complete -> pending_review in the same transaction, so
// the applicant's resting status after this call is actually
// pending_review, not intake_complete - see that migration's comment for
// why. This function still only ever writes 'intake_complete'; it isn't
// aware of (or responsible for) the cascade.
export async function completeIntake(resumeToken: string): Promise<CompleteIntakeResult> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("applicants")
    .update({ status: "intake_complete" })
    .eq("resume_token", resumeToken)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { success: false, reason: "not_found" };
  }

  // X3 message 1/7. Best-effort: a notification failure here must not
  // block intake completion, the same reasoning P4 already established
  // for reschedule/cancel notifications.
  await notifyBestEffort(
    () => notifyApplicationReceived(admin, data.id),
    "applicant_notification_failed",
    { applicant_id: data.id },
  );

  return { success: true };
}
