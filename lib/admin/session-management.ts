"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";
import { rescheduleMeetingOccurrence, cancelMeetingOccurrence } from "@/lib/zoom/meeting";
import { getDefaultZoomCredentials, type ZoomCredentials } from "@/lib/zoom/client";
import { notifySessionRescheduled, notifySessionCancelled } from "@/lib/messaging/session-notifications";
import { notifyBestEffort } from "@/lib/messaging/notify-best-effort";

export type SessionMutationResult =
  | { success: true }
  // Zoom wasn't updated because this session has no video_occurrence_id
  // (created before A3 PR4, or Zoom returned none) - the DB change still
  // went through, but an admin needs to update the Zoom occurrence
  // themselves. Never a dead end: the warning names exactly what to do.
  | { success: true; zoomWarning: string }
  | { success: false; error: string };

interface SessionVideoDetails {
  cohortId: string;
  videoMeetingId: string | null;
  videoOccurrenceId: string | null;
  videoJoinUrl: string | null;
  scheduledAt: string;
  cohortTimeZone: string;
}

type SessionLookupResult =
  | { found: true; session: SessionVideoDetails }
  | { found: false; error: string };

// A real query error (e.g. schema drift - a column the code expects
// doesn't actually exist on this database) is surfaced with its own
// message, never collapsed into "Session not found." - that message is
// reserved for when the row genuinely doesn't exist, so an admin (or
// whoever's debugging with them) isn't misled into looking for a missing
// row when the actual problem is a missing column.
async function lookUpSessionVideoDetails(admin: SupabaseClient, sessionId: string): Promise<SessionLookupResult> {
  const { data, error } = await admin
    .from("sessions")
    .select("cohort_id, video_meeting_id, video_occurrence_id, video_join_url, scheduled_at, cohorts(time_zone)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) return { found: false, error: error.message };
  if (!data) return { found: false, error: "Session not found." };
  return {
    found: true,
    session: {
      cohortId: data.cohort_id,
      videoMeetingId: data.video_meeting_id,
      videoOccurrenceId: data.video_occurrence_id,
      videoJoinUrl: data.video_join_url,
      scheduledAt: data.scheduled_at,
      cohortTimeZone: (data.cohorts as unknown as { time_zone: string } | null)?.time_zone ?? "UTC",
    },
  };
}

export async function rescheduleSessionAction(
  sessionId: string,
  newScheduledAt: string,
  callerClient?: SupabaseClient,
  zoomCredentials?: ZoomCredentials,
  zoomFetchImpl?: typeof fetch,
): Promise<SessionMutationResult> {
  const { userId } = await requireRole(["admin"], callerClient);
  const admin = createAdminClient();

  const lookup = await lookUpSessionVideoDetails(admin, sessionId);
  if (!lookup.found) return { success: false, error: lookup.error };
  const session = lookup.session;

  let zoomWarning: string | undefined;
  if (session.videoMeetingId && session.videoOccurrenceId) {
    try {
      await rescheduleMeetingOccurrence(
        session.videoMeetingId,
        session.videoOccurrenceId,
        newScheduledAt,
        zoomCredentials ?? getDefaultZoomCredentials(),
        zoomFetchImpl ?? fetch,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Zoom occurrence update failed.";
      return { success: false, error: `Zoom was not updated - the session was not rescheduled. ${message}` };
    }
  } else {
    zoomWarning = "This session has no linked Zoom occurrence - the join link's date was not updated in Zoom.";
  }

  const { error: rescheduleError } = await admin.rpc("reschedule_session", {
    actor_id: userId,
    target_session_id: sessionId,
    new_scheduled_at: newScheduledAt,
  });
  if (rescheduleError) return { success: false, error: rescheduleError.message };

  await notifyBestEffort(
    () =>
      notifySessionRescheduled(
        admin,
        session.cohortId,
        sessionId,
        new Date(newScheduledAt),
        session.cohortTimeZone,
        session.videoJoinUrl,
      ),
    "session_notification_failed",
    { session_id: sessionId, cohort_id: session.cohortId },
  );

  revalidatePath(`/admin/cohorts/${session.cohortId}`);
  return zoomWarning ? { success: true, zoomWarning } : { success: true };
}

export async function cancelSessionAction(
  sessionId: string,
  reason: string,
  callerClient?: SupabaseClient,
  zoomCredentials?: ZoomCredentials,
  zoomFetchImpl?: typeof fetch,
): Promise<SessionMutationResult> {
  const { userId } = await requireRole(["admin"], callerClient);
  const admin = createAdminClient();

  const lookup = await lookUpSessionVideoDetails(admin, sessionId);
  if (!lookup.found) return { success: false, error: lookup.error };
  const session = lookup.session;

  let zoomWarning: string | undefined;
  if (session.videoMeetingId && session.videoOccurrenceId) {
    try {
      await cancelMeetingOccurrence(
        session.videoMeetingId,
        session.videoOccurrenceId,
        zoomCredentials ?? getDefaultZoomCredentials(),
        zoomFetchImpl ?? fetch,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Zoom occurrence cancellation failed.";
      return { success: false, error: `Zoom was not updated - the session was not cancelled. ${message}` };
    }
  } else {
    zoomWarning = "This session has no linked Zoom occurrence - it was not removed from Zoom.";
  }

  const { error: cancelError } = await admin.rpc("cancel_session", {
    actor_id: userId,
    target_session_id: sessionId,
    reason,
  });
  if (cancelError) return { success: false, error: cancelError.message };

  await notifyBestEffort(
    () =>
      notifySessionCancelled(admin, session.cohortId, sessionId, new Date(session.scheduledAt), session.cohortTimeZone),
    "session_notification_failed",
    { session_id: sessionId, cohort_id: session.cohortId },
  );

  revalidatePath(`/admin/cohorts/${session.cohortId}`);
  return zoomWarning ? { success: true, zoomWarning } : { success: true };
}

/**
 * No Zoom call: the meeting's host is the Zoom account owner, not the
 * facilitator, so swapping in a substitute doesn't change anything about
 * the meeting itself - only who is expected to run it.
 */
export async function recordSessionSubstituteAction(
  sessionId: string,
  substituteFacilitatorId: string | null,
  callerClient?: SupabaseClient,
): Promise<SessionMutationResult> {
  const { userId } = await requireRole(["admin"], callerClient);
  const admin = createAdminClient();

  const lookup = await lookUpSessionVideoDetails(admin, sessionId);
  if (!lookup.found) return { success: false, error: lookup.error };
  const session = lookup.session;

  const { error } = await admin.rpc("record_session_substitute", {
    actor_id: userId,
    target_session_id: sessionId,
    new_substitute_facilitator_id: substituteFacilitatorId,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/cohorts/${session.cohortId}`);
  return { success: true };
}
