"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/roles";

export interface CohortDeliverySummary {
  id: string;
  name: string;
  status: string;
  sessionsScheduled: number;
  sessionsCompleted: number;
  sessionsCancelled: number;
}

/**
 * Delivery summary across every cohort - admin sees all of them via the
 * caller's OWN RLS-respecting client (cohorts_select_admin_only), same
 * "let the database do the real scoping" pattern as lib/admin/cohorts.ts.
 * Session counts are computed here rather than via a SQL aggregate
 * function, since there's no reusable admin-reporting function yet and
 * the row counts involved are small (this project's whole scale, per
 * CLAUDE.md invariant #3: no third-party analytics, plain SQL/Postgres).
 */
export async function getCohortDeliverySummary(callerClient?: SupabaseClient): Promise<CohortDeliverySummary[]> {
  const supabase = callerClient ?? (await createClient());
  await requireRole(["admin"], supabase);

  const { data: cohorts, error: cohortsError } = await supabase
    .from("cohorts")
    .select("id, name, status")
    .order("created_at", { ascending: false });
  if (cohortsError) throw cohortsError;

  const { data: sessions, error: sessionsError } = await supabase.from("sessions").select("cohort_id, status");
  if (sessionsError) throw sessionsError;

  return cohorts.map((cohort) => {
    const cohortSessions = sessions.filter((s) => s.cohort_id === cohort.id);
    return {
      id: cohort.id,
      name: cohort.name,
      status: cohort.status,
      sessionsScheduled: cohortSessions.filter((s) => s.status === "scheduled").length,
      sessionsCompleted: cohortSessions.filter((s) => s.status === "completed").length,
      sessionsCancelled: cohortSessions.filter((s) => s.status === "cancelled").length,
    };
  });
}

export interface PartnerReferralSummaryRow {
  id: string;
  // Opaque, partner-supplied - CLAUDE.md invariant #8: "echo only in the
  // partner export." This IS that export.
  partnerReferenceId: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  cohortName: string | null;
}

/**
 * A partner org's own referred applicants and their status - the "partner
 * export" named in invariant #8. Uses the caller's OWN RLS-respecting
 * client: applicants_select_own_partner_org_or_admin (P2) already scopes
 * this correctly to the caller's own partner_organization_id, so no new
 * policy or manual filter is needed here.
 */
export async function getPartnerReferralSummary(
  callerClient?: SupabaseClient,
): Promise<PartnerReferralSummaryRow[]> {
  const supabase = callerClient ?? (await createClient());
  await requireRole(["partner_staff"], supabase);

  const { data, error } = await supabase
    .from("applicants")
    .select("id, partner_reference_id, first_name, last_name, status, cohorts(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    partnerReferenceId: row.partner_reference_id,
    firstName: row.first_name,
    lastName: row.last_name,
    status: row.status,
    cohortName: (row.cohorts as unknown as { name: string } | null)?.name ?? null,
  }));
}
