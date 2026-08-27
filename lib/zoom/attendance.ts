import "server-only";
import { zoomApiRequest, getDefaultZoomCredentials, type ZoomCredentials } from "@/lib/zoom/client";

/**
 * Pulls a past meeting's participant report and shapes it into pre-fill
 * suggestions - never a commit. CLAUDE.md's hard invariant #7: attendance
 * is pre-filled, never auto-committed; a facilitator confirms. This module
 * has no attendance table to write to yet (that's A3/A5's territory) and
 * wouldn't write to one even if it existed - it only returns data for a
 * caller to show a facilitator.
 *
 * Per CLAUDE.md's learned constraints: Zoom identifies phone joiners by
 * number, not name - this module does NOT attempt to match a phone number
 * to a member. That's X4's job (Wave 9, E.164 matching, "never guess
 * partial matches"). This module surfaces Zoom's raw participant data
 * faithfully; matching it to a real member is out of scope here.
 */

export interface ZoomParticipant {
  participantId: string;
  /** For a phone joiner, Zoom reports this as the phone number itself, not a name - see the module doc comment. */
  name: string;
  email: string | null;
  joinTime: string;
  leaveTime: string;
  durationMinutes: number;
}

export interface AttendancePreFill {
  meetingId: string;
  /** The full, untransformed Zoom response - store this alongside the confirmed attendance per the session prompt ("when the two disagree, we want to know"). */
  rawReport: unknown;
  participants: ZoomParticipant[];
}

interface ZoomParticipantReportResponse {
  participants: Array<{
    id?: string;
    name: string;
    user_email?: string;
    join_time: string;
    leave_time: string;
    duration: number;
  }>;
}

export async function getAttendancePreFill(
  meetingId: string,
  credentials: ZoomCredentials = getDefaultZoomCredentials(),
  fetchImpl: typeof fetch = fetch,
): Promise<AttendancePreFill> {
  const response = await zoomApiRequest(
    `/report/meetings/${encodeURIComponent(meetingId)}/participants?page_size=300`,
    {},
    credentials,
    fetchImpl,
  );

  const body = (await response.json()) as ZoomParticipantReportResponse;

  return {
    meetingId,
    rawReport: body,
    participants: body.participants.map((p, index) => ({
      // Zoom's `id` for a guest participant is often absent (PII
      // restriction on the Report API) - fall back to a stable
      // per-report index so the caller always has something to key on.
      participantId: p.id ?? `unidentified-${index}`,
      name: p.name,
      email: p.user_email ?? null,
      joinTime: p.join_time,
      leaveTime: p.leave_time,
      durationMinutes: Math.round(p.duration / 60),
    })),
  };
}
