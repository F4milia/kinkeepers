"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";

async function facilitatorEmails(admin: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  // No pagination handling yet - fine at this scale (a handful of
  // facilitators), same tradeoff already accepted in
  // lib/auth/admin-issue-sign-in-link.ts's own email lookup.
  const { data } = await admin.auth.admin.listUsers();
  const wanted = new Set(ids);
  for (const user of data.users) {
    if (wanted.has(user.id) && user.email) map.set(user.id, user.email);
  }
  return map;
}

export interface CohortListItem {
  id: string;
  name: string;
  groupingDescription: string;
  status: string;
  capacity: number;
  programName: string | null;
  facilitatorEmail: string | null;
  firstSessionDate: string | null;
  zoomSetupError: string | null;
}

/**
 * Scoped by the CALLER'S OWN RLS, not the admin client - the point is
 * that the database does the real per-role narrowing (admin sees every
 * cohort; a facilitator sees only their own, via the policy A3 PR1
 * added; partner_staff currently sees none, honestly, since "cohorts
 * containing caregivers they referred" scoping doesn't exist yet - A5's
 * job, Wave 7). The role check here is coarse defense-in-depth on top of
 * that, matching every other list function in this codebase, using the
 * layout's own allowed set rather than narrowing it.
 */
export async function listCohorts(callerClient?: SupabaseClient): Promise<CohortListItem[]> {
  const supabase = callerClient ?? (await createClient());
  await requireRole(["admin", "facilitator", "partner_staff"], supabase);

  const { data: cohorts, error } = await supabase
    .from("cohorts")
    .select(
      "id, name, grouping_description, status, capacity, first_session_date, zoom_setup_error, facilitator_id, programs(name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const facilitatorIds = [...new Set(cohorts.map((c) => c.facilitator_id).filter((id): id is string => !!id))];
  const emails = await facilitatorEmails(createAdminClient(), facilitatorIds);

  return cohorts.map((c) => ({
    id: c.id,
    name: c.name,
    groupingDescription: c.grouping_description,
    status: c.status,
    capacity: c.capacity,
    programName: (c.programs as unknown as { name: string } | null)?.name ?? null,
    facilitatorEmail: c.facilitator_id ? (emails.get(c.facilitator_id) ?? null) : null,
    firstSessionDate: c.first_session_date,
    zoomSetupError: c.zoom_setup_error,
  }));
}

export interface SessionListItem {
  id: string;
  sessionNumber: number;
  scheduledAt: string;
  status: string;
  videoJoinUrl: string | null;
  cancellationReason: string | null;
  substituteFacilitatorEmail: string | null;
}

export interface CohortDetail extends CohortListItem {
  timeZone: string;
  meetingDayOfWeek: number;
  meetingTime: string;
  cadence: string;
  deliveryFormat: string | null;
  sessions: SessionListItem[];
}

export async function getCohortDetail(
  cohortId: string,
  callerClient?: SupabaseClient,
): Promise<CohortDetail | null> {
  const supabase = callerClient ?? (await createClient());
  await requireRole(["admin", "facilitator", "partner_staff"], supabase);

  const { data: cohort, error } = await supabase
    .from("cohorts")
    .select(
      "id, name, grouping_description, status, capacity, first_session_date, zoom_setup_error, facilitator_id, time_zone, meeting_day_of_week, meeting_time, cadence, delivery_format, programs(name)",
    )
    .eq("id", cohortId)
    .maybeSingle();
  if (error || !cohort) return null;

  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("id, session_number, scheduled_at, status, video_join_url, cancellation_reason, substitute_facilitator_id")
    .eq("cohort_id", cohortId)
    .order("session_number");
  if (sessionsError) throw sessionsError;

  const admin = createAdminClient();
  const emailTargets = [
    ...(cohort.facilitator_id ? [cohort.facilitator_id] : []),
    ...sessions.map((s) => s.substitute_facilitator_id).filter((id): id is string => !!id),
  ];
  const emails = await facilitatorEmails(admin, [...new Set(emailTargets)]);

  return {
    id: cohort.id,
    name: cohort.name,
    groupingDescription: cohort.grouping_description,
    status: cohort.status,
    capacity: cohort.capacity,
    programName: (cohort.programs as unknown as { name: string } | null)?.name ?? null,
    facilitatorEmail: cohort.facilitator_id ? (emails.get(cohort.facilitator_id) ?? null) : null,
    firstSessionDate: cohort.first_session_date,
    zoomSetupError: cohort.zoom_setup_error,
    timeZone: cohort.time_zone,
    meetingDayOfWeek: cohort.meeting_day_of_week,
    meetingTime: cohort.meeting_time,
    cadence: cohort.cadence,
    deliveryFormat: cohort.delivery_format,
    sessions: sessions.map((s) => ({
      id: s.id,
      sessionNumber: s.session_number,
      scheduledAt: s.scheduled_at,
      status: s.status,
      videoJoinUrl: s.video_join_url,
      cancellationReason: s.cancellation_reason,
      substituteFacilitatorEmail: s.substitute_facilitator_id
        ? (emails.get(s.substitute_facilitator_id) ?? null)
        : null,
    })),
  };
}

export interface SelectableProgram {
  id: string;
  name: string;
  sessionCount: number;
}

export async function listLicensedPrograms(callerClient?: SupabaseClient): Promise<SelectableProgram[]> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("programs")
    .select("id, name, session_count")
    .eq("license_status", "licensed")
    .order("name");
  if (error) throw error;
  return data.map((p) => ({ id: p.id, name: p.name, sessionCount: p.session_count }));
}

export interface SelectableFacilitator {
  id: string;
  email: string;
}

export async function listFacilitators(callerClient?: SupabaseClient): Promise<SelectableFacilitator[]> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { data: facilitatorProfiles, error } = await admin.from("profiles").select("id").eq("role", "facilitator");
  if (error) throw error;

  const emails = await facilitatorEmails(
    admin,
    facilitatorProfiles.map((p) => p.id),
  );
  return facilitatorProfiles
    .filter((p) => emails.has(p.id))
    .map((p) => ({ id: p.id, email: emails.get(p.id)! }));
}
