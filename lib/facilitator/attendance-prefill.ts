"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ForbiddenError } from "@/lib/auth/roles";
import { getAttendancePreFill } from "@/lib/zoom/attendance";
import { getDefaultZoomCredentials, type ZoomCredentials } from "@/lib/zoom/client";
import { matchPhoneParticipants } from "@/lib/zoom/phone-matching";

export interface AttendancePreFillSuggestion {
  applicantId: string;
  method: "video" | "phone";
}

export interface UnidentifiedCaller {
  participantId: string;
  last4: string;
}

export type AttendancePreFillResult =
  | { available: true; suggestions: AttendancePreFillSuggestion[]; unidentifiedCallers: UnidentifiedCaller[] }
  | { available: false; reason: string };

/**
 * The pre-fill step CLAUDE.md invariant #7 and P3's own prompt describe
 * ("after a session ends, pull the Zoom participant report and pre-fill
 * the facilitator's attendance list") but that was never actually wired
 * to a real page - P3 only built the raw fetch (lib/zoom/attendance.ts),
 * explicitly deferring both video-email matching and phone matching to
 * later ("that's X4's job"). This is that wiring, for both at once - a
 * gap in video matching specifically was never assigned to any session
 * by name, confirmed with Ferenz before building it here rather than
 * leaving X4's own phone-matching connected to nothing.
 *
 * Never auto-commits anything (invariant #7) - this only returns
 * suggestions for the caller to seed a form with; submit_session_log()
 * is still the only real write path, and the facilitator can change any
 * suggestion before submitting.
 *
 * `callerClient`, `zoomCredentials`, and `zoomFetchImpl` are all optional
 * and exist for testability, same reasoning as elsewhere in this
 * codebase (requireRole(), createRecurringMeeting()) - real callers
 * never pass them. `zoomCredentials` is resolved lazily (not a default
 * parameter value, which JS evaluates eagerly at call time, before this
 * function's own role/ownership/occurrence checks ever run) - a caller
 * without permission, or a session with no video_occurrence_id, gets
 * that answer without this function ever needing real Zoom credentials
 * to exist at all.
 */
export async function getSessionAttendancePreFillAction(
  sessionId: string,
  callerClient?: SupabaseClient,
  zoomCredentials?: ZoomCredentials,
  zoomFetchImpl: typeof fetch = fetch,
): Promise<AttendancePreFillResult> {
  const { userId, role } = await requireRole(["facilitator", "admin"], callerClient);
  const admin = createAdminClient();

  const { data: session, error: sessionError } = await admin
    .from("sessions")
    .select("cohort_id, video_occurrence_id, substitute_facilitator_id, cohorts(facilitator_id)")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) return { available: false, reason: sessionError.message };
  if (!session) return { available: false, reason: "Session not found." };

  if (role !== "admin") {
    const cohortFacilitatorId = (session.cohorts as unknown as { facilitator_id: string | null } | null)?.facilitator_id;
    const isOwner = cohortFacilitatorId === userId || session.substitute_facilitator_id === userId;
    if (!isOwner) throw new ForbiddenError(role, ["admin"]);
  }

  if (!session.video_occurrence_id) {
    return { available: false, reason: "No Zoom occurrence recorded for this session." };
  }

  const { data: applicants, error: applicantsError } = await admin
    .from("applicants")
    .select("id, email, phone")
    .eq("cohort_id", session.cohort_id);
  if (applicantsError) return { available: false, reason: applicantsError.message };

  let preFill;
  try {
    preFill = await getAttendancePreFill(session.video_occurrence_id, zoomCredentials ?? getDefaultZoomCredentials(), zoomFetchImpl);
  } catch {
    return { available: false, reason: "Could not reach Zoom for this session's participant report." };
  }

  const emailToApplicant = new Map(
    (applicants ?? []).filter((a) => a.email).map((a) => [a.email!.toLowerCase(), a.id]),
  );

  const suggestions: AttendancePreFillSuggestion[] = [];
  const matchedByEmail = new Set<string>();
  for (const participant of preFill.participants) {
    if (!participant.email) continue;
    const applicantId = emailToApplicant.get(participant.email.toLowerCase());
    if (applicantId) {
      suggestions.push({ applicantId, method: "video" });
      matchedByEmail.add(participant.participantId);
    }
  }

  const unidentifiedCallers: UnidentifiedCaller[] = [];
  const phoneResults = matchPhoneParticipants(
    preFill.participants.filter((p) => !matchedByEmail.has(p.participantId)),
    (applicants ?? []).map((a) => ({ applicantId: a.id, phone: a.phone })),
  );
  for (const result of phoneResults) {
    if (result.status === "matched" && result.applicantId) {
      suggestions.push({ applicantId: result.applicantId, method: "phone" });
    } else if (result.last4) {
      unidentifiedCallers.push({ participantId: result.participantId, last4: result.last4 });
    }
  }

  return { available: true, suggestions, unidentifiedCallers };
}
