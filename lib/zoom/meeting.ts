import "server-only";
import { zoomApiRequest, getDefaultZoomCredentials, type ZoomCredentials } from "@/lib/zoom/client";

/**
 * Recurring meeting creation with the five settings CLAUDE.md's hard
 * invariant #6 requires enforced at creation time, so a facilitator can
 * never end up with a non-compliant meeting: auto_recording none,
 * waiting_room true, password required, join_before_host false, and
 * screen-share host-only.
 *
 * IMPORTANT, verified-uncertain: only the first four of those five map to
 * a documented field in Zoom's meeting-creation `settings` object
 * (auto_recording, waiting_room, join_before_host, and an explicit
 * `password`). Screen-share-host-only does not appear to be a
 * per-meeting-creation field in Zoom's API at all in anything I could
 * find - every source describing it treats it as an account- or
 * user-level setting (Zoom's web portal, or a separate
 * /users/{userId}/settings "in-meeting" settings call), not something
 * this endpoint's request body can carry. I could not get a clean fetch
 * of Zoom's current official API reference to confirm this either way
 * (JS-rendered docs site; forum examples I found disagree with each
 * other on some field names, e.g. weekly_days vs week_days, suggesting
 * different API versions). This function sends the four settings I have
 * higher confidence in; screen-share-host-only is NOT sent per-meeting
 * here and needs to be confirmed as an account-level default (Ivan's
 * Zoom Workplace for Healthcare account setup) or implemented as a
 * separate settings-API call once real credentials exist to verify
 * against. Flagging rather than guessing at an unverified field name.
 */

export interface CreateRecurringMeetingParams {
  /** Meeting topic - this module doesn't decide what's safe to put here; the caller owns that. */
  topic: string;
  /** ISO 8601 date-time of the first session, in the given timezone. */
  startTime: string;
  /** IANA timezone, e.g. "America/New_York". */
  timezone: string;
  durationMinutes: number;
  /** From the program row - never hardcoded by a caller. */
  sessionCount: number;
  /** 1 = weekly, 2 = every other week. */
  repeatIntervalWeeks: number;
}

export interface CreatedMeeting {
  meetingId: string;
  joinUrl: string;
  passcode: string;
  /** null when Zoom returns no dial-in numbers for this account/plan. */
  dialInNumber: string | null;
  /**
   * Best-effort mapping: Zoom's h323_password is what phone/SIP dial-in
   * participants actually enter, distinct from the web-join passcode in
   * some account configurations. Falls back to the passcode if Zoom
   * doesn't return one. Unverified against a real account - flag if this
   * turns out wrong once real credentials exist.
   */
  dialInPin: string | null;
  /**
   * Zoom's own id for each occurrence in the recurring series, ordered by
   * start_time (which matches session_number order, since sessions run in
   * a fixed cadence). Each is required later to reschedule or cancel that
   * one session's Zoom occurrence without touching the rest of the
   * series, via PATCH /meetings/{meetingId}/occurrences/{occurrence_id}.
   * Empty when Zoom returns no occurrences array (e.g. a non-recurring
   * meeting), which should not happen for this function's request but is
   * not assumed.
   */
  occurrenceIds: string[];
}

interface ZoomCreateMeetingResponse {
  id: number;
  join_url: string;
  password: string;
  h323_password?: string;
  settings?: {
    global_dial_in_numbers?: Array<{ number: string; type: string; country: string }>;
  };
  occurrences?: Array<{ occurrence_id: string; start_time: string }>;
}

export async function createRecurringMeeting(
  params: CreateRecurringMeetingParams,
  credentials: ZoomCredentials = getDefaultZoomCredentials(),
  fetchImpl: typeof fetch = fetch,
): Promise<CreatedMeeting> {
  const requestBody = {
    topic: params.topic,
    type: 8, // recurring meeting, fixed time
    start_time: params.startTime,
    timezone: params.timezone,
    duration: params.durationMinutes,
    password: generateMeetingPasscode(),
    recurrence: {
      type: 2, // weekly
      repeat_interval: params.repeatIntervalWeeks,
      end_times: params.sessionCount,
    },
    settings: {
      auto_recording: "none",
      waiting_room: true,
      join_before_host: false,
      // No enforce-able field found for screen-share host-only - see the
      // module doc comment above.
    },
  };

  const response = await zoomApiRequest(
    "/users/me/meetings",
    { method: "POST", body: JSON.stringify(requestBody) },
    credentials,
    fetchImpl,
  );

  const body = (await response.json()) as ZoomCreateMeetingResponse;

  const occurrenceIds = [...(body.occurrences ?? [])]
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((occurrence) => occurrence.occurrence_id);

  return {
    meetingId: String(body.id),
    joinUrl: body.join_url,
    passcode: body.password,
    dialInNumber: body.settings?.global_dial_in_numbers?.[0]?.number ?? null,
    dialInPin: body.h323_password ?? body.password ?? null,
    occurrenceIds,
  };
}

/**
 * Moves one occurrence of a recurring meeting to a new start time, via
 * Zoom's occurrence-scoped update endpoint - the other occurrences in the
 * series are untouched. Requires the occurrence_id captured at meeting
 * creation (CreatedMeeting.occurrenceIds); there is no way to address a
 * single occurrence by date/session-number alone.
 */
export async function rescheduleMeetingOccurrence(
  meetingId: string,
  occurrenceId: string,
  newStartTime: string,
  credentials: ZoomCredentials = getDefaultZoomCredentials(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await zoomApiRequest(
    `/meetings/${meetingId}/occurrences/${occurrenceId}`,
    { method: "PATCH", body: JSON.stringify({ start_time: newStartTime }) },
    credentials,
    fetchImpl,
  );
}

/**
 * Cancels one occurrence of a recurring meeting, leaving the rest of the
 * series (and the meeting itself) intact.
 */
export async function cancelMeetingOccurrence(
  meetingId: string,
  occurrenceId: string,
  credentials: ZoomCredentials = getDefaultZoomCredentials(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await zoomApiRequest(
    `/meetings/${meetingId}?occurrence_id=${encodeURIComponent(occurrenceId)}`,
    { method: "DELETE" },
    credentials,
    fetchImpl,
  );
}

// Zoom passcodes: alphanumeric, max 10 characters per Zoom's constraint.
function generateMeetingPasscode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let passcode = "";
  for (let i = 0; i < 10; i++) {
    passcode += chars[Math.floor(Math.random() * chars.length)];
  }
  return passcode;
}
