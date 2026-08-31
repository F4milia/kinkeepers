"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";
import { rescheduleMeetingOccurrence, cancelMeetingOccurrence } from "@/lib/zoom/meeting";
import { getDefaultZoomCredentials, type ZoomCredentials } from "@/lib/zoom/client";

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
}

async function getSessionVideoDetails(
  admin: SupabaseClient,
  sessionId: string,
): Promise<SessionVideoDetails | null> {
  const { data, error } = await admin
    .from("sessions")
    .select("cohort_id, video_meeting_id, video_occurrence_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return { cohortId: data.cohort_id, videoMeetingId: data.video_meeting_id, videoOccurrenceId: data.video_occurrence_id };
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

  const session = await getSessionVideoDetails(admin, sessionId);
  if (!session) return { success: false, error: "Session not found." };

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

  const session = await getSessionVideoDetails(admin, sessionId);
  if (!session) return { success: false, error: "Session not found." };

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

  const session = await getSessionVideoDetails(admin, sessionId);
  if (!session) return { success: false, error: "Session not found." };

  const { error } = await admin.rpc("record_session_substitute", {
    actor_id: userId,
    target_session_id: sessionId,
    new_substitute_facilitator_id: substituteFacilitatorId,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/cohorts/${session.cohortId}`);
  return { success: true };
}
