import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyMember, type MemberContact } from "@/lib/messaging/notify-member";
import { formatMeetingTime } from "@/lib/admin/cohort-meeting-time";
import { COPY } from "@/lib/copy";

/**
 * PLACEHOLDER COPY: P4 (this session) has no access to X3's real
 * transactional message text (X3, Wave 7, owns member-facing message
 * copy; its own enumerated message list isn't in this repo - same gap
 * lib/referral/send-resume-email.ts already flagged for the intake
 * resume link). Minimal and functionally descriptive only, not final -
 * same treatment P2 gave that email and P6 gave placeholder legal text.
 * Flag before this reaches a real caregiver.
 *
 * CLAUDE.md invariant #2 (no health information in any outbound
 * message) is honored here regardless of copy finality: nothing below
 * names dementia, caregiving, or the group - "meeting" is as specific
 * as this gets, matching the restraint of the existing sign-in-code
 * message ("Your KinKeepers sign-in code is 123456"). The support phone
 * number is the same placeholder already used in the member copy deck
 * (lib/copy.ts's own comment: reserved for fictional use, a demo tap
 * can't reach a real person) - reused here rather than inventing a
 * second fake number.
 */

interface EnrolledMemberContact {
  applicantId: string;
  contact: MemberContact;
  timeZone: string | null;
}

async function listEnrolledMembers(admin: SupabaseClient, cohortId: string): Promise<EnrolledMemberContact[]> {
  const { data, error } = await admin
    .from("applicants")
    .select("id, email, phone, preferred_contact_channel, time_zone")
    .eq("cohort_id", cohortId)
    .in("status", ["enrolled", "attending"]);
  if (error) throw error;

  return data.map((row) => ({
    applicantId: row.id,
    contact: { email: row.email, phone: row.phone, preferredContactChannel: row.preferred_contact_channel },
    timeZone: row.time_zone,
  }));
}

/**
 * The "say both" pattern already established for cohort meeting times
 * (lib/admin/cohort-meeting-time.ts's describeCohortMeetingForApplicant)
 * applied to a SPECIFIC known instant rather than "the next recurring
 * occurrence from now" - a rescheduled session's new time is already an
 * exact instant, not something to recompute from the cohort's weekly
 * slot. Reuses formatMeetingTime (already exported) rather than
 * duplicating its DST-aware rendering.
 *
 * Named edge case this closes: every member of a cohort previously got
 * the identical message rendered only in the cohort's own zone,
 * regardless of their own - wrong for "Applicant in Honolulu, cohort in
 * Eastern" exactly like cohort-meeting-time.ts's own named edge case.
 * Degrades to cohort-only when intake never recorded the member's zone,
 * matching describeCohortMeetingForApplicant's own fallback contract
 * (it requires a zone; callers already default to the cohort's own when
 * the applicant's is unknown - see lib/admin/assignment.ts).
 */
function describeInstantForMember(instant: Date, memberTimeZone: string | null, cohortTimeZone: string): string {
  const cohortSide = formatMeetingTime(instant, cohortTimeZone);
  if (!memberTimeZone) return cohortSide;
  const memberSide = formatMeetingTime(instant, memberTimeZone);
  return `${memberSide} your time (${cohortSide} for the group)`;
}

export async function notifySessionRescheduled(
  admin: SupabaseClient,
  cohortId: string,
  newInstant: Date,
  cohortTimeZone: string,
  joinUrl: string | null,
): Promise<void> {
  const members = await listEnrolledMembers(admin, cohortId);

  await Promise.all(
    members.map(({ applicantId, contact, timeZone }) => {
      const timeDescription = describeInstantForMember(newInstant, timeZone, cohortTimeZone);
      const joinLine = joinUrl ? ` Join link: ${joinUrl}.` : "";
      return notifyMember({
        contact,
        subject: "KinKeepers: your meeting time has changed",
        emailHtml: `<p>Your KinKeepers meeting has a new time: ${timeDescription}.${joinLine}</p><p>Questions? Call ${COPY.support.phoneNumber}.</p>`,
        smsBody: `KinKeepers: your meeting time changed to ${timeDescription}.${joinLine} Questions? Call ${COPY.support.phoneNumber}.`,
        logContext: { applicant_id: applicantId, cohort_id: cohortId, notification: "session_rescheduled" },
      });
    }),
  );
}

export async function notifySessionCancelled(
  admin: SupabaseClient,
  cohortId: string,
  cancelledInstant: Date,
  cohortTimeZone: string,
): Promise<void> {
  const members = await listEnrolledMembers(admin, cohortId);

  await Promise.all(
    members.map(({ applicantId, contact, timeZone }) => {
      const timeDescription = describeInstantForMember(cancelledInstant, timeZone, cohortTimeZone);
      return notifyMember({
        contact,
        subject: "KinKeepers: your meeting has been cancelled",
        emailHtml: `<p>Your KinKeepers meeting on ${timeDescription} has been cancelled.</p><p>Questions? Call ${COPY.support.phoneNumber}.</p>`,
        smsBody: `KinKeepers: your meeting on ${timeDescription} is cancelled. Questions? Call ${COPY.support.phoneNumber}.`,
        logContext: { applicant_id: applicantId, cohort_id: cohortId, notification: "session_cancelled" },
      });
    }),
  );
}
