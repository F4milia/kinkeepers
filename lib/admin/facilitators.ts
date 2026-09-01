"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";
import { listFacilitators as listFacilitatorProfiles } from "@/lib/admin/cohorts";

const EXPIRY_WARNING_DAYS = 60;

export interface FacilitatorCertification {
  id: string;
  programId: string;
  programName: string;
  certifiedOn: string;
  expiresOn: string;
  certifyingBody: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export interface FacilitatorListItem {
  id: string;
  email: string;
  activeCohortCount: number;
  sessionsNext7Days: number;
  certifications: FacilitatorCertification[];
}

/**
 * "CERTIFICATION TRACKING - the part that actually matters" (A4-cert
 * prompt). Facilitator name/contact/time zone display is deliberately
 * not here - profiles has no such columns yet (same gap L3 hit for
 * account info) - confirmed with Ferenz to defer rather than invent.
 * Email (real, from auth.users via the existing listFacilitators())
 * stands in as the identifier.
 */
export async function listFacilitatorsWithCertifications(
  callerClient?: SupabaseClient,
): Promise<FacilitatorListItem[]> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();

  const facilitators = await listFacilitatorProfiles(callerClient);
  if (facilitators.length === 0) return [];
  const facilitatorIds = facilitators.map((f) => f.id);

  const { data: cohorts, error: cohortsError } = await admin
    .from("cohorts")
    .select("id, facilitator_id")
    .in("facilitator_id", facilitatorIds)
    .eq("status", "active");
  if (cohortsError) throw cohortsError;

  const cohortIds = cohorts.map((c) => c.id);
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);

  const { data: sessions, error: sessionsError } =
    cohortIds.length > 0
      ? await admin
          .from("sessions")
          .select("cohort_id")
          .in("cohort_id", cohortIds)
          .gte("scheduled_at", now.toISOString())
          .lte("scheduled_at", in7Days.toISOString())
      : { data: [] as { cohort_id: string }[], error: null };
  if (sessionsError) throw sessionsError;

  const { data: certs, error: certsError } = await admin
    .from("facilitator_certifications")
    .select("id, facilitator_id, program_id, certified_on, expires_on, certifying_body, programs(name)")
    .in("facilitator_id", facilitatorIds)
    .order("expires_on", { ascending: true });
  if (certsError) throw certsError;

  const today = now.toISOString().slice(0, 10);
  const warningDate = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86_400_000).toISOString().slice(0, 10);

  return facilitators.map((facilitator) => {
    const ownCohortIds = new Set(
      cohorts.filter((c) => c.facilitator_id === facilitator.id).map((c) => c.id),
    );

    const certifications: FacilitatorCertification[] = (certs ?? [])
      .filter((c) => c.facilitator_id === facilitator.id)
      .map((c) => ({
        id: c.id,
        programId: c.program_id,
        programName: (c.programs as unknown as { name: string } | null)?.name ?? "Unknown program",
        certifiedOn: c.certified_on,
        expiresOn: c.expires_on,
        certifyingBody: c.certifying_body,
        isExpired: c.expires_on < today,
        isExpiringSoon: c.expires_on >= today && c.expires_on <= warningDate,
      }));

    return {
      id: facilitator.id,
      email: facilitator.email,
      activeCohortCount: ownCohortIds.size,
      sessionsNext7Days: (sessions ?? []).filter((s) => ownCohortIds.has(s.cohort_id)).length,
      certifications,
    };
  });
}

export interface FacilitatorDetail extends FacilitatorListItem {
  allPrograms: { id: string; name: string }[];
}

export async function getFacilitatorDetail(
  facilitatorId: string,
  callerClient?: SupabaseClient,
): Promise<FacilitatorDetail | null> {
  const facilitators = await listFacilitatorsWithCertifications(callerClient);
  const facilitator = facilitators.find((f) => f.id === facilitatorId);
  if (!facilitator) return null;

  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { data: allPrograms, error } = await admin
    .from("programs")
    .select("id, name")
    .eq("license_status", "licensed")
    .order("name", { ascending: true });
  if (error) throw error;

  return { ...facilitator, allPrograms };
}

export interface AddCertificationFormState {
  status: "idle" | "error";
  fieldErrors: Partial<Record<"programId" | "certifiedOn" | "expiresOn" | "certifyingBody", string>>;
  formError?: string;
}

export async function addFacilitatorCertificationAction(
  facilitatorId: string,
  _prevState: AddCertificationFormState,
  formData: FormData,
  callerClient?: SupabaseClient,
): Promise<AddCertificationFormState> {
  const { userId } = await requireRole(["admin"], callerClient);

  const programId = String(formData.get("programId") ?? "").trim();
  const certifiedOn = String(formData.get("certifiedOn") ?? "").trim();
  const expiresOn = String(formData.get("expiresOn") ?? "").trim();
  const certifyingBody = String(formData.get("certifyingBody") ?? "").trim();

  const fieldErrors: AddCertificationFormState["fieldErrors"] = {};
  if (!programId) fieldErrors.programId = "Choose a program.";
  if (!certifiedOn) fieldErrors.certifiedOn = "This can't be empty.";
  if (!expiresOn) fieldErrors.expiresOn = "This can't be empty.";
  if (certifiedOn && expiresOn && expiresOn <= certifiedOn) {
    fieldErrors.expiresOn = "Expiration must be after the certification date.";
  }
  if (!certifyingBody) fieldErrors.certifyingBody = "This can't be empty.";
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("add_facilitator_certification", {
    actor_id: userId,
    target_facilitator_id: facilitatorId,
    target_program_id: programId,
    p_certified_on: certifiedOn,
    p_expires_on: expiresOn,
    p_certifying_body: certifyingBody,
  });
  if (error) {
    return { status: "error", fieldErrors: {}, formError: "Something went wrong. Try again." };
  }

  revalidatePath(`/admin/facilitators/${facilitatorId}`);
  revalidatePath("/admin/facilitators");
  return { status: "idle", fieldErrors: {} };
}
