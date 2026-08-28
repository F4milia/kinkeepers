"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";

export interface PartnerOrganization {
  id: string;
  name: string;
  referral_link_slug: string;
  status: "active" | "inactive";
  contract_start: string | null;
  contract_end: string | null;
  notes: string | null;
  created_at: string;
}

export async function listPartnerOrganizations(
  callerClient?: SupabaseClient,
): Promise<PartnerOrganization[]> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_organizations")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getPartnerOrganization(
  id: string,
  callerClient?: SupabaseClient,
): Promise<PartnerOrganization | null> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { data, error } = await admin.from("partner_organizations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export interface PartnerOrganizationFormState {
  status: "idle" | "error";
  fieldErrors: Partial<Record<"name" | "referralLinkSlug" | "contractDates", string>>;
  formError?: string;
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;

interface ParsedFields {
  name: string;
  referralLinkSlug: string;
  status: "active" | "inactive";
  contractStart: string | null;
  contractEnd: string | null;
  notes: string | null;
}

function parseFields(formData: FormData): { fields: ParsedFields } | { fieldErrors: PartnerOrganizationFormState["fieldErrors"] } {
  const name = String(formData.get("name") ?? "").trim();
  const referralLinkSlug = String(formData.get("referralLinkSlug") ?? "").trim();
  const status = formData.get("status") === "inactive" ? "inactive" : "active";
  const contractStart = String(formData.get("contractStart") ?? "").trim() || null;
  const contractEnd = String(formData.get("contractEnd") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const fieldErrors: PartnerOrganizationFormState["fieldErrors"] = {};
  if (!name) fieldErrors.name = "This can't be empty.";
  if (!referralLinkSlug) {
    fieldErrors.referralLinkSlug = "This can't be empty.";
  } else if (!SLUG_PATTERN.test(referralLinkSlug)) {
    fieldErrors.referralLinkSlug = "Lowercase letters, numbers, and hyphens only.";
  }
  if (contractStart && contractEnd && contractEnd < contractStart) {
    fieldErrors.contractDates = "The contract end date can't be before the start date.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { fields: { name, referralLinkSlug, status, contractStart, contractEnd, notes } };
}

/**
 * Bound to a <form action> via useActionState. Both create and update
 * call the security-definer functions from A1 PR3's migration (never a
 * plain insert/update) so the mutation and its audit_log row succeed or
 * fail together in one transaction.
 */
export async function createPartnerOrganizationAction(
  _prevState: PartnerOrganizationFormState,
  formData: FormData,
  callerClient?: SupabaseClient,
): Promise<PartnerOrganizationFormState> {
  const { userId } = await requireRole(["admin"], callerClient);

  const parsed = parseFields(formData);
  if ("fieldErrors" in parsed) {
    return { status: "error", fieldErrors: parsed.fieldErrors };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_create_partner_organization", {
    actor_id: userId,
    p_name: parsed.fields.name,
    p_referral_link_slug: parsed.fields.referralLinkSlug,
    p_status: parsed.fields.status,
    p_contract_start: parsed.fields.contractStart,
    p_contract_end: parsed.fields.contractEnd,
    p_notes: parsed.fields.notes,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        fieldErrors: { referralLinkSlug: "That referral link is already in use by another organization." },
      };
    }
    return { status: "error", fieldErrors: {}, formError: "Something went wrong. Try again." };
  }

  revalidatePath("/admin/partners");
  redirect("/admin/partners");
}

export async function updatePartnerOrganizationAction(
  id: string,
  _prevState: PartnerOrganizationFormState,
  formData: FormData,
  callerClient?: SupabaseClient,
): Promise<PartnerOrganizationFormState> {
  const { userId } = await requireRole(["admin"], callerClient);

  const parsed = parseFields(formData);
  if ("fieldErrors" in parsed) {
    return { status: "error", fieldErrors: parsed.fieldErrors };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_update_partner_organization", {
    actor_id: userId,
    target_id: id,
    p_name: parsed.fields.name,
    p_referral_link_slug: parsed.fields.referralLinkSlug,
    p_status: parsed.fields.status,
    p_contract_start: parsed.fields.contractStart,
    p_contract_end: parsed.fields.contractEnd,
    p_notes: parsed.fields.notes,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        fieldErrors: { referralLinkSlug: "That referral link is already in use by another organization." },
      };
    }
    return { status: "error", fieldErrors: {}, formError: "Something went wrong. Try again." };
  }

  revalidatePath("/admin/partners");
  redirect("/admin/partners");
}
