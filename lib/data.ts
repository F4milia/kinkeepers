/**
 * Data access layer. Every screen reads through these functions, never
 * through lib/fixtures directly (lib/fixtures is test-only from L5
 * onward). Real Supabase queries, scoped by the caller's own session -
 * RLS is the access-control boundary (CLAUDE.md invariant #9), not a
 * check duplicated here.
 *
 * Every exported function takes an optional trailing `callerClient` -
 * same testability pattern already established throughout this codebase
 * (lib/auth/roles.ts, lib/admin/*.ts): real callers never pass it and get
 * the cookie-bound request client from lib/supabase/server.ts, which
 * requires a Next.js request context a plain vitest run can't provide.
 * Tests pass a real client authenticated as a specific user instead (see
 * test/helpers/local-auth.ts's clientForUser).
 *
 * Two real schema gaps found while building this (see CLAUDE.md's L5
 * Learned Constraints entry and this session's own PR description) have
 * no backing table yet: facilitator display name/bio (profiles has no
 * name column at all) and the discussion board (no posts table exists).
 * getFacilitator and getPosts are honest not-yet-available states, not
 * invented schema - confirmed with Ferenz before writing either.
 *
 * A thrown DataUnavailableError (lib/data-errors.ts) is caught by the
 * nearest route-segment error.tsx. notFound() (Next's own) covers a
 * session/cohort id that doesn't resolve, or a signed-in account with no
 * real enrollment at all.
 */
import "server-only";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DataUnavailableError } from "@/lib/data-errors";
import { sessionDateTimeFields, zoneFriendlyLabel } from "@/lib/session-time";
import type {
  Applicant,
  Cohort,
  CohortMember,
  CohortStatus,
  Facilitator,
  Post,
  Session,
  SessionStatus,
} from "@/lib/types";

async function resolveClient(callerClient?: SupabaseClient): Promise<SupabaseClient> {
  return callerClient ?? (await createClient());
}

/**
 * A malformed id (a stale bookmark, a hand-edited URL) should read as
 * "not found," not a raw Postgres "invalid input syntax for uuid" error
 * bubbling up as a generic DataUnavailableError - not_found is the more
 * honest state for a URL that was simply never valid.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------
// Identity: resolves the signed-in member to their real enrollment row.
// ---------------------------------------------------------------------

interface CurrentApplicant {
  id: string;
  cohortId: string | null;
  firstName: string;
  timeZone: string | null;
}

/**
 * Claims (see the migration's own comment for the matching rule) and
 * loads the signed-in member's own applicant row. notFound() for any
 * account with no real, unambiguous enrollment - there's no useful
 * "retry" for an identity that doesn't resolve, and the copy ("we
 * couldn't find that... call us") is honest for this case too.
 */
async function getCurrentApplicantOrNotFound(supabase: SupabaseClient): Promise<CurrentApplicant> {
  const { data: applicantId, error: claimError } = await supabase.rpc("claim_applicant_for_current_user");
  if (claimError) throw new DataUnavailableError(claimError.message);
  if (!applicantId) notFound();

  const { data, error } = await supabase
    .from("applicants")
    .select("id, cohort_id, first_name, time_zone")
    .eq("id", applicantId)
    .maybeSingle();
  if (error) throw new DataUnavailableError(error.message);
  if (!data) notFound();

  return { id: data.id, cohortId: data.cohort_id, firstName: data.first_name ?? "", timeZone: data.time_zone };
}

export async function getViewer(callerClient?: SupabaseClient): Promise<CohortMember> {
  const supabase = await resolveClient(callerClient);
  const applicant = await getCurrentApplicantOrNotFound(supabase);
  if (!applicant.cohortId) notFound();
  return { id: applicant.id, cohortId: applicant.cohortId, firstName: applicant.firstName, caringFor: "", role: "member" };
}

/** Facilitators are profiles rows directly (auth.uid() = cohorts.facilitator_id) - no identity bridge needed, unlike members. */
async function getCurrentFacilitatorId(supabase: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  return user.id;
}

export async function getFacilitatorViewer(callerClient?: SupabaseClient): Promise<Facilitator> {
  const supabase = await resolveClient(callerClient);
  const facilitatorId = await getCurrentFacilitatorId(supabase);
  // No display name exists for a facilitator anywhere in the schema yet
  // (profiles has no name/bio column - see this file's own header
  // comment) - the F1 greeting degrades to a plain "Hello" rather than a
  // fabricated name.
  return { id: facilitatorId, cohortId: "", firstName: "", caringFor: "", role: "facilitator" };
}

// ---------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------

const COHORT_SELECT =
  "id, name, grouping_description, cadence, time_zone, capacity, status, delivery_format, facilitator_id, programs(name, session_count)";

interface CohortRow {
  id: string;
  name: string;
  grouping_description: string;
  cadence: string;
  time_zone: string;
  capacity: number;
  status: string;
  delivery_format: "video" | "in_person" | null;
  facilitator_id: string | null;
  programs: { name: string; session_count: number } | null;
}

function mapCohortStatus(status: string): CohortStatus {
  if (status === "draft") return "forming";
  if (status === "completed" || status === "cancelled") return "completed";
  return "active";
}

async function countPastSessions(supabase: SupabaseClient, cohortId: string): Promise<number> {
  const { count, error } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", cohortId)
    .lte("scheduled_at", new Date().toISOString());
  if (error) throw new DataUnavailableError(error.message);
  return count ?? 0;
}

async function toCohort(supabase: SupabaseClient, row: CohortRow): Promise<Cohort> {
  const program = row.programs as unknown as { name: string; session_count: number } | null;
  const sessionTotal = program?.session_count ?? 0;
  const pastCount = await countPastSessions(supabase, row.id);
  const sessionNumber = sessionTotal > 0 ? Math.min(sessionTotal, pastCount + 1) : pastCount + 1;

  return {
    id: row.id,
    name: row.name,
    grouping: row.grouping_description,
    program: program?.name ?? "",
    cadence: row.cadence,
    timeZoneLabel: zoneFriendlyLabel(row.time_zone),
    capacity: row.capacity,
    status: mapCohortStatus(row.status),
    sessionNumber,
    sessionTotal,
    deliveryFormat: row.delivery_format ?? "video",
  };
}

export async function getCohort(cohortId: string, callerClient?: SupabaseClient): Promise<Cohort | undefined> {
  if (!UUID_PATTERN.test(cohortId)) return undefined;
  const supabase = await resolveClient(callerClient);
  const { data, error } = await supabase.from("cohorts").select(COHORT_SELECT).eq("id", cohortId).maybeSingle();
  if (error) throw new DataUnavailableError(error.message);
  if (!data) return undefined;
  return toCohort(supabase, data as unknown as CohortRow);
}

/**
 * The roster: this member's own cohort-mates (list_cohort_roster, real
 * first/last names only - see the migration for why it's a narrow
 * function rather than a broadened RLS policy) plus one facilitator row
 * when the cohort has one assigned. The facilitator row has an empty
 * firstName - CohortPage renders that as the "not yet available" label
 * rather than a blank name (profiles has no name column to show).
 */
export async function getCohortMembers(cohortId: string, callerClient?: SupabaseClient): Promise<CohortMember[]> {
  const supabase = await resolveClient(callerClient);

  const [{ data: roster, error: rosterError }, { data: cohort, error: cohortError }] = await Promise.all([
    supabase.rpc("list_cohort_roster"),
    supabase.from("cohorts").select("id, facilitator_id").eq("id", cohortId).maybeSingle(),
  ]);
  if (rosterError) throw new DataUnavailableError(rosterError.message);
  if (cohortError) throw new DataUnavailableError(cohortError.message);

  const rows = (roster ?? []) as unknown as Array<{ applicant_id: string; first_name: string | null; last_name: string | null }>;
  const members: CohortMember[] = rows.map((row) => ({
    id: row.applicant_id,
    cohortId,
    firstName: row.first_name ?? "",
    caringFor: "",
    role: "member",
  }));

  if (cohort?.facilitator_id) {
    members.push({ id: cohort.facilitator_id, cohortId, firstName: "", caringFor: "", role: "facilitator" });
  }

  return members;
}

/** No facilitator display name/bio exists anywhere in the schema yet (see this file's own header comment) - honestly not-yet-available, not invented. */
export async function getFacilitator(_cohortId: string): Promise<Facilitator | undefined> {
  return undefined;
}

// ---------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------

const SESSION_SELECT = "id, cohort_id, session_number, scheduled_at, status, video_join_url";

interface SessionRow {
  id: string;
  cohort_id: string;
  session_number: number;
  scheduled_at: string;
  status: "scheduled" | "completed" | "cancelled";
  video_join_url: string | null;
}

function mapSessionStatus(status: SessionRow["status"]): SessionStatus {
  return status === "scheduled" ? "upcoming" : "past";
}

async function toSession(
  row: SessionRow,
  cohort: { time_zone: string; delivery_format: "video" | "in_person" | null; programs: { session_count: number } | null },
  memberTimeZone: string | null,
): Promise<Session> {
  const instant = new Date(row.scheduled_at);
  const { date, time, timeZoneLabel } = sessionDateTimeFields(instant, memberTimeZone ?? cohort.time_zone);

  return {
    id: row.id,
    cohortId: row.cohort_id,
    sessionNumber: row.session_number,
    sessionTotal: cohort.programs?.session_count ?? 0,
    status: mapSessionStatus(row.status),
    date,
    time,
    timeZoneLabel,
    // sessions carries no duration column of its own - programs.session_duration_minutes
    // is the curriculum's per-session length, not fetched here since no
    // consumer of Session.durationMinutes exists on a real per-session
    // query path yet other than formatSessionTimeRange's end-time math,
    // which degrades gracefully (same start/end) at 0.
    durationMinutes: 0,
    deliveryFormat: cohort.delivery_format ?? "video",
    // Licensed curriculum topics stay null until Ivan confirms display is
    // permitted (CLAUDE.md invariant #10) - never populated from any
    // source.
    topic: null,
    joinUrl: row.status === "scheduled" ? row.video_join_url : null,
    // No materials table exists yet.
    materialsCount: 0,
  };
}

async function getCohortTimeZoneAndFormat(
  supabase: SupabaseClient,
  cohortId: string,
): Promise<{ time_zone: string; delivery_format: "video" | "in_person" | null; programs: { session_count: number } | null }> {
  const { data, error } = await supabase
    .from("cohorts")
    .select("time_zone, delivery_format, programs(session_count)")
    .eq("id", cohortId)
    .maybeSingle();
  if (error) throw new DataUnavailableError(error.message);
  if (!data) throw new DataUnavailableError("Cohort not found for session");
  return data as unknown as { time_zone: string; delivery_format: "video" | "in_person" | null; programs: { session_count: number } | null };
}

/**
 * The signed-in member's own time_zone, when their account resolves to a
 * real enrollment - same "say both" fallback already established in
 * lib/messaging/session-notifications.ts (degrades to the cohort's own
 * zone when the member's isn't known). Not every caller of getSessions
 * has a resolvable member (none today, but this stays defensive rather
 * than throwing) - null falls back to the cohort's zone in toSession.
 */
async function currentMemberTimeZoneOrNull(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("applicants").select("time_zone").eq("profile_id", user.id).maybeSingle();
  return data?.time_zone ?? null;
}

export async function getSessions(cohortId: string, callerClient?: SupabaseClient): Promise<Session[]> {
  const supabase = await resolveClient(callerClient);
  const [{ data: rows, error }, cohort, memberTimeZone] = await Promise.all([
    supabase.from("sessions").select(SESSION_SELECT).eq("cohort_id", cohortId).order("session_number", { ascending: true }),
    getCohortTimeZoneAndFormat(supabase, cohortId),
    currentMemberTimeZoneOrNull(supabase),
  ]);
  if (error) throw new DataUnavailableError(error.message);

  return Promise.all((rows ?? []).map((row) => toSession(row as SessionRow, cohort, memberTimeZone)));
}

export async function getUpcomingSession(cohortId: string, callerClient?: SupabaseClient): Promise<Session | undefined> {
  const sessions = await getSessions(cohortId, callerClient);
  return sessions.find((session) => session.status === "upcoming");
}

export async function getSession(sessionId: string, callerClient?: SupabaseClient): Promise<Session | undefined> {
  if (!UUID_PATTERN.test(sessionId)) return undefined;
  const supabase = await resolveClient(callerClient);
  const { data: row, error } = await supabase.from("sessions").select(SESSION_SELECT).eq("id", sessionId).maybeSingle();
  if (error) throw new DataUnavailableError(error.message);
  if (!row) return undefined;

  const typedRow = row as SessionRow;
  const [cohort, memberTimeZone] = await Promise.all([
    getCohortTimeZoneAndFormat(supabase, typedRow.cohort_id),
    currentMemberTimeZoneOrNull(supabase),
  ]);
  return toSession(typedRow, cohort, memberTimeZone);
}

// ---------------------------------------------------------------------
// Discussion - no real table exists yet (see this file's own header
// comment). Honest not-yet-available: always empty, never invented.
// ---------------------------------------------------------------------

export async function getPosts(_cohortId: string): Promise<Post[]> {
  return [];
}

// ---------------------------------------------------------------------
// Facilitator (F1): cohorts.facilitator_id = auth.uid() directly - no
// identity bridge needed, RLS (cohorts_select_own_facilitator /
// sessions_select_own_facilitator) already scopes every query below.
// ---------------------------------------------------------------------

export async function getFacilitatorCohorts(callerClient?: SupabaseClient): Promise<Cohort[]> {
  const supabase = await resolveClient(callerClient);
  const { data, error } = await supabase.from("cohorts").select(COHORT_SELECT);
  if (error) throw new DataUnavailableError(error.message);
  return Promise.all((data ?? []).map((row) => toCohort(supabase, row as unknown as CohortRow)));
}

export async function getFacilitatorSessions(callerClient?: SupabaseClient): Promise<Session[]> {
  const supabase = await resolveClient(callerClient);
  const cohorts = await getFacilitatorCohorts(supabase);
  const cohortIds = cohorts.map((c) => c.id);
  if (cohortIds.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("sessions")
    .select(`${SESSION_SELECT}, cohorts(time_zone, delivery_format, programs(session_count))`)
    .in("cohort_id", cohortIds)
    .order("scheduled_at", { ascending: true });
  if (error) throw new DataUnavailableError(error.message);

  return Promise.all(
    (rows ?? []).map((row) => {
      const cohort = (row as unknown as { cohorts: { time_zone: string; delivery_format: "video" | "in_person" | null; programs: { session_count: number } | null } }).cohorts;
      // A facilitator's own schedule always renders in each cohort's own
      // zone, not a personal one - there's no "facilitator's home time
      // zone" concept anywhere in the schema, unlike a member's.
      return toSession(row as SessionRow, cohort, null);
    }),
  );
}

export interface FacilitatorScheduleSession extends Session {
  /** ids of other facilitator sessions this one overlaps in time — F1's "collisions" flag. */
  overlapsSessionIds: string[];
}

function sessionsOverlap(a: Session, b: Session): boolean {
  // Sessions carry no real duration (see toSession's own comment) - two
  // sessions "overlap" here only when they share the exact same date and
  // start time, a narrower but honest definition given there's no real
  // duration to compare ranges against yet.
  return a.date === b.date && a.time === b.time;
}

export async function getFacilitatorSchedule(callerClient?: SupabaseClient): Promise<FacilitatorScheduleSession[]> {
  const facilitatorSessions = await getFacilitatorSessions(callerClient);
  return facilitatorSessions.map((session) => ({
    ...session,
    overlapsSessionIds: facilitatorSessions
      .filter((other) => other.id !== session.id && sessionsOverlap(session, other))
      .map((other) => other.id),
  }));
}

export async function getNextFacilitatorSession(callerClient?: SupabaseClient): Promise<Session | undefined> {
  const sessions = await getFacilitatorSessions(callerClient);
  return sessions.find((session) => session.status === "upcoming");
}

/**
 * Past sessions with no delivery confirmation yet. No session-log
 * backend exists at all yet (attendance tracking is X4's unbuilt
 * territory, per this session's own explicit assumption list) - every
 * past session is honestly "needs a log" since no log has ever been
 * submitted for any of them.
 */
export async function getFacilitatorSessionsNeedingLog(callerClient?: SupabaseClient): Promise<Session[]> {
  const sessions = await getFacilitatorSessions(callerClient);
  return sessions.filter((session) => session.status === "past");
}

// ---------------------------------------------------------------------
// Applicant status (L4) - the one member-facing screen that is
// deliberately pre-auth, reached via an unguessable id mailed to the
// applicant directly (same "not something to search for" reasoning as
// the intake resume_token). No signed-in session exists on this path, so
// this reads via the service-role client, narrowly, by primary key only
// - never a list, never a search. `adminClient` is optional, same
// testability reasoning as callerClient elsewhere in this file.
// ---------------------------------------------------------------------

export async function getApplicant(applicantId: string, adminClient?: SupabaseClient): Promise<Applicant | undefined> {
  // A malformed id (a stale bookmark, a fixture-era slug from before this
  // route had a real backend) should read as "not found," not a raw
  // Postgres "invalid input syntax for uuid" error.
  if (!UUID_PATTERN.test(applicantId)) return undefined;

  const admin = adminClient ?? createAdminClient();

  // No direct FK from applicants to programs - the only real path is
  // applicants.cohort_id -> cohorts.program_id -> programs.id, so the
  // completed-program name is a nested embed through cohorts, not a
  // (nonexistent) direct one.
  const { data, error } = await admin
    .from("applicants")
    .select("id, first_name, status, cohort:cohorts(programs(name))")
    .eq("id", applicantId)
    .maybeSingle();
  if (error) throw new DataUnavailableError(error.message);
  if (!data) return undefined;

  const status = data.status as string;
  if (status === "pending_review") {
    return {
      id: data.id,
      firstName: data.first_name ?? "",
      status: "pending_review",
      // No real "does an open cohort exist for this applicant" signal
      // exists (confirmed with Ferenz - see this PR's description);
      // always false rather than guessing, so this only ever renders the
      // non-specific "we're finding your group" state.
      hasMatchingCohort: false,
    };
  }

  if (status === "enrolled" || status === "attending") {
    const session = await getAssignedSessionForApplicant(admin, applicantId);
    return { id: data.id, firstName: data.first_name ?? "", status: "enrolled", assignedSession: session };
  }

  if (status === "completed") {
    const cohort = data.cohort as unknown as { programs: { name: string } | null } | null;
    return {
      id: data.id,
      firstName: data.first_name ?? "",
      status: "completed",
      completedProgramName: cohort?.programs?.name,
    };
  }

  // referred, intake_complete, declined, withdrawn: not part of the
  // applicant-facing UI at all (see the Applicant type's own comment).
  return undefined;
}

async function getAssignedSessionForApplicant(
  admin: SupabaseClient,
  applicantId: string,
): Promise<Applicant["assignedSession"]> {
  const { data: applicant, error: applicantError } = await admin
    .from("applicants")
    .select("cohort_id, time_zone")
    .eq("id", applicantId)
    .maybeSingle();
  if (applicantError) throw new DataUnavailableError(applicantError.message);
  if (!applicant?.cohort_id) return undefined;

  const { data: cohort, error: cohortError } = await admin
    .from("cohorts")
    .select("time_zone, delivery_format")
    .eq("id", applicant.cohort_id)
    .maybeSingle();
  if (cohortError) throw new DataUnavailableError(cohortError.message);
  if (!cohort) return undefined;

  const { data: session, error: sessionError } = await admin
    .from("sessions")
    .select("scheduled_at, video_join_url, video_dial_in_number, video_dial_in_pin")
    .eq("cohort_id", applicant.cohort_id)
    .eq("session_number", 1)
    .maybeSingle();
  if (sessionError) throw new DataUnavailableError(sessionError.message);
  if (!session) return undefined;

  const { date, time, timeZoneLabel } = sessionDateTimeFields(
    new Date(session.scheduled_at),
    applicant.time_zone ?? cohort.time_zone,
  );

  return {
    date,
    time,
    timeZoneLabel,
    joinUrl: session.video_join_url,
    dialInNumber: session.video_dial_in_number ?? "",
    dialInPin: session.video_dial_in_pin ?? "",
    // No facilitator display name exists anywhere in the schema yet -
    // see this file's own header comment. The status page skips this
    // line entirely when it's empty rather than showing a blank name.
    facilitatorFirstName: "",
  };
}
