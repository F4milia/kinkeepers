"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";

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
