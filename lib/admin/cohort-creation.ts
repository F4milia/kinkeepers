"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";
import { createRecurringMeeting, type CreatedMeeting } from "@/lib/zoom/meeting";
import type { ZoomCredentials } from "@/lib/zoom/client";
import { resolveZoomCredentialsForPartner } from "@/lib/zoom/credentials";
import { generateSessionInstants } from "@/lib/admin/cohort-meeting-time";

export interface CreateCohortInput {
  name: string;
  groupingDescription: string;
  programId: string;
  facilitatorId: string;
  partnerOrganizationId?: string;
  cadence: "weekly" | "biweekly";
  meetingDayOfWeek: number;
  /** 24-hour "HH:MM", in `timeZone`. */
  meetingTime: string;
  timeZone: string;
  /** "YYYY-MM-DD" - the admin's own choice, not derived from meetingDayOfWeek. */
  firstSessionDate: string;
  capacity: number;
  deliveryFormat: "video" | "in_person";
}

export type CreateCohortResult =
  | { success: true; cohortId: string; status: "active" }
  | { success: true; cohortId: string; status: "draft"; zoomError: string }
  | { success: false; error: string };

/**
 * Orchestrates cohort creation: insert draft -> call Zoom -> finalize or
 * mark-failed. Can't be one atomic SQL function the way A1/A2's
 * mutations are - the Zoom call in the middle is a real external API
 * request, which can't run inside a Postgres transaction. See
 * supabase/migrations/20260829190100_cohort_creation_functions.sql for
 * why the two DB-only halves are each atomic on their own instead.
 *
 * `callerClient`/`zoomCredentials`/`zoomFetchImpl` are optional and
 * exist for testability, matching every other privileged action in this
 * codebase - real callers never pass them.
 */
export async function createCohortAction(
  input: CreateCohortInput,
  callerClient?: SupabaseClient,
  zoomCredentials?: ZoomCredentials,
  zoomFetchImpl?: typeof fetch,
): Promise<CreateCohortResult> {
  const { userId } = await requireRole(["admin"], callerClient);
  const admin = createAdminClient();

  // session_count/session_duration_minutes come from the program row,
  // never hardcoded (CLAUDE.md invariant #10 / this session's own "grep
  // to confirm" acceptance criterion).
  const { data: program, error: programError } = await admin
    .from("programs")
    .select("session_count, session_duration_minutes")
    .eq("id", input.programId)
    .single();
  if (programError || !program) {
    return { success: false, error: "Program not found." };
  }

  const { data: draftCohort, error: draftError } = await admin
    .from("cohorts")
    .insert({
      name: input.name,
      grouping_description: input.groupingDescription,
      program_id: input.programId,
      facilitator_id: input.facilitatorId,
      partner_organization_id: input.partnerOrganizationId ?? null,
      cadence: input.cadence,
      meeting_day_of_week: input.meetingDayOfWeek,
      meeting_time: input.meetingTime,
      time_zone: input.timeZone,
      first_session_date: input.firstSessionDate,
      capacity: input.capacity,
      delivery_format: input.deliveryFormat,
      status: "draft",
    })
    .select("id")
    .single();

  // The program-licensing / facilitator-role triggers raise here for an
  // invalid program or facilitator - surfaced as-is rather than
  // re-validated at this layer, since the DB is the actual enforcement
  // point (see the schema migration's own reasoning).
  if (draftError || !draftCohort) {
    return { success: false, error: draftError?.message ?? "Failed to create cohort." };
  }

  const cohortId: string = draftCohort.id;
  const cadenceDays = input.cadence === "biweekly" ? 14 : 7;
  const sessionInstants = generateSessionInstants(
    input.meetingTime,
    input.timeZone,
    input.firstSessionDate,
    cadenceDays,
    program.session_count,
  );

  // P3: "a cohort may carry its own Zoom credentials" - resolved from
  // the cohort's partner, not skipped when a test passes its own
  // zoomCredentials override (that override still wins outright, same
  // as before this change; video_provider is just labeled 'kinkeepers'
  // for that case since no test currently asserts on it).
  const { credentials: resolvedCredentials, provider: videoProvider } = zoomCredentials
    ? { credentials: zoomCredentials, provider: "kinkeepers" as const }
    : await resolveZoomCredentialsForPartner(admin, input.partnerOrganizationId);

  let meeting: CreatedMeeting;
  try {
    meeting = await createRecurringMeeting(
      {
        topic: input.name,
        startTime: sessionInstants[0].toISOString(),
        timezone: input.timeZone,
        durationMinutes: program.session_duration_minutes,
        sessionCount: program.session_count,
        repeatIntervalWeeks: input.cadence === "biweekly" ? 2 : 1,
      },
      resolvedCredentials,
      zoomFetchImpl ?? fetch,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zoom meeting creation failed.";
    const { error: markError } = await admin.rpc("mark_cohort_creation_failed", {
      actor_id: userId,
      target_cohort_id: cohortId,
      error_message: message,
    });
    if (markError) {
      return { success: false, error: "Zoom setup failed, and recording that failure also failed." };
    }
    revalidatePath("/admin/cohorts");
    return { success: true, cohortId, status: "draft", zoomError: message };
  }

  const { error: finalizeError } = await admin.rpc("finalize_cohort_sessions", {
    actor_id: userId,
    target_cohort_id: cohortId,
    p_video_meeting_id: meeting.meetingId,
    p_video_join_url: meeting.joinUrl,
    p_video_passcode: meeting.passcode,
    p_video_dial_in_number: meeting.dialInNumber,
    p_video_dial_in_pin: meeting.dialInPin,
    session_instants: sessionInstants.map((instant) => instant.toISOString()),
    // Only passed when Zoom actually returned one id per session - an
    // empty or short array falls back to the SQL function's own default
    // (every session's occurrence id stored as null) rather than
    // mis-assigning ids to the wrong sessions.
    video_occurrence_ids:
      meeting.occurrenceIds.length === sessionInstants.length ? meeting.occurrenceIds : undefined,
    p_video_provider: videoProvider,
  });

  if (finalizeError) {
    return { success: false, error: "Zoom meeting was created, but saving the cohort's sessions failed." };
  }

  revalidatePath("/admin/cohorts");
  return { success: true, cohortId, status: "active" };
}
