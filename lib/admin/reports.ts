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

export interface UnloggedPastSession {
  id: string;
  cohortId: string;
  cohortName: string;
  sessionNumber: number;
  scheduledAt: string;
}

/**
 * A5: sessions whose scheduled time has passed with no session_logs row
 * yet - the facilitator hasn't confirmed delivery/attendance for a
 * session that already happened. Two-query-then-filter-in-JS, same
 * pattern as getCohortDeliverySummary above (no reusable admin-reporting
 * aggregate exists yet, and row counts are small at this project's
 * scale). `sessions.status` never transitions to anything but
 * 'scheduled'/'cancelled' anywhere in this codebase (confirmed by grep -
 * nothing sets 'completed') - so "past" is determined by scheduled_at
 * alone, not by status.
 */
export async function getUnloggedPastSessions(callerClient?: SupabaseClient): Promise<UnloggedPastSession[]> {
  const supabase = callerClient ?? (await createClient());
  await requireRole(["admin"], supabase);

  const [{ data: sessions, error: sessionsError }, { data: logs, error: logsError }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, cohort_id, session_number, scheduled_at, cohorts(name)")
      .eq("status", "scheduled")
      .lt("scheduled_at", new Date().toISOString()),
    supabase.from("session_logs").select("session_id"),
  ]);
  if (sessionsError) throw sessionsError;
  if (logsError) throw logsError;

  const loggedSessionIds = new Set(logs.map((log) => log.session_id));

  return sessions
    .filter((session) => !loggedSessionIds.has(session.id))
    .map((session) => ({
      id: session.id,
      cohortId: session.cohort_id,
      cohortName: (session.cohorts as unknown as { name: string } | null)?.name ?? "Unknown cohort",
      sessionNumber: session.session_number,
      scheduledAt: session.scheduled_at,
    }))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}

export interface ConsecutiveAbsenceFlag {
  applicantId: string;
  firstName: string | null;
  lastName: string | null;
  cohortId: string;
  cohortName: string;
  missedSessionNumbers: [number, number];
}

/**
 * A5: a member whose two most recently LOGGED sessions, back to back by
 * session_number, were both marked 'absent' - CLAUDE.md invariant #5:
 * "Absence counts only... surface signal, never decide," so this is a
 * plain factual flag (two real consecutive misses), not a score. Excused
 * absences don't count - only the bare 'absent' status. A gap (e.g.
 * absent at session 3, present at 4, absent at 5) is deliberately NOT
 * flagged - the two most recent logged session_numbers must differ by
 * exactly 1, or it isn't "in a row."
 */
export async function getConsecutiveAbsenceFlags(callerClient?: SupabaseClient): Promise<ConsecutiveAbsenceFlag[]> {
  const supabase = callerClient ?? (await createClient());
  await requireRole(["admin"], supabase);

  const [{ data: attendance, error: attendanceError }, { data: applicants, error: applicantsError }] =
    await Promise.all([
      supabase.from("session_attendance").select("applicant_id, status, sessions(session_number, cohort_id, cohorts(name))"),
      supabase.from("applicants").select("id, first_name, last_name"),
    ]);
  if (attendanceError) throw attendanceError;
  if (applicantsError) throw applicantsError;

  const applicantById = new Map(applicants.map((applicant) => [applicant.id, applicant]));

  const recordsByApplicant = new Map<
    string,
    { sessionNumber: number; status: string; cohortId: string; cohortName: string }[]
  >();
  for (const row of attendance) {
    const session = row.sessions as unknown as {
      session_number: number;
      cohort_id: string;
      cohorts: { name: string } | null;
    } | null;
    if (!session) continue;
    const records = recordsByApplicant.get(row.applicant_id) ?? [];
    records.push({
      sessionNumber: session.session_number,
      status: row.status,
      cohortId: session.cohort_id,
      cohortName: session.cohorts?.name ?? "Unknown cohort",
    });
    recordsByApplicant.set(row.applicant_id, records);
  }

  const flags: ConsecutiveAbsenceFlag[] = [];
  for (const [applicantId, records] of recordsByApplicant) {
    records.sort((a, b) => a.sessionNumber - b.sessionNumber);
    const mostRecent = records[records.length - 1];
    const secondMostRecent = records[records.length - 2];
    if (
      mostRecent &&
      secondMostRecent &&
      mostRecent.status === "absent" &&
      secondMostRecent.status === "absent" &&
      mostRecent.sessionNumber - secondMostRecent.sessionNumber === 1
    ) {
      const applicant = applicantById.get(applicantId);
      flags.push({
        applicantId,
        firstName: applicant?.first_name ?? null,
        lastName: applicant?.last_name ?? null,
        cohortId: mostRecent.cohortId,
        cohortName: mostRecent.cohortName,
        missedSessionNumbers: [secondMostRecent.sessionNumber, mostRecent.sessionNumber],
      });
    }
  }
  return flags;
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
