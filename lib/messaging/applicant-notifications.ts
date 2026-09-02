import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyMember, type MemberContact } from "@/lib/messaging/notify-member";
import { describeInstantForMember, unsubscribeLine } from "@/lib/messaging/session-notifications";
import { COPY, format } from "@/lib/copy";

interface ApplicantContactRow {
  contact: MemberContact;
  timeZone: string | null;
  unsubscribeToken: string;
}

async function getApplicantContact(admin: SupabaseClient, applicantId: string): Promise<ApplicantContactRow | null> {
  const { data, error } = await admin
    .from("applicants")
    .select("email, phone, preferred_contact_channel, time_zone, notification_unsubscribe_token, notifications_opted_out")
    .eq("id", applicantId)
    .maybeSingle();
  if (error) throw error;
  // Same "an opted-out member simply never appears" contract as
  // listEnrolledMembers (session-notifications.ts) - checked explicitly
  // here rather than in a where clause, since this looks up exactly one
  // known applicant rather than filtering a cohort roster.
  if (!data || data.notifications_opted_out) return null;

  return {
    contact: { email: data.email, phone: data.phone, preferredContactChannel: data.preferred_contact_channel },
    timeZone: data.time_zone,
    unsubscribeToken: data.notification_unsubscribe_token,
  };
}

/**
 * X3 message 1/7: fires from lib/referral/actions.ts's completeIntake().
 * Uses the run doc's own quoted text verbatim ("We'll be in touch within
 * three business days.") rather than drafting new copy for it.
 */
export async function notifyApplicationReceived(admin: SupabaseClient, applicantId: string): Promise<void> {
  const applicant = await getApplicantContact(admin, applicantId);
  if (!applicant) return;
  const { contact, unsubscribeToken } = applicant;

  await notifyMember({
    admin,
    applicantId,
    notificationType: "application_received",
    dedupKey: `${applicantId}:application_received`,
    contact,
    subject: "KinKeepers: we have your information",
    emailHtml: `<p>We have your information. We'll be in touch within three business days.</p><p>Questions? Call ${COPY.support.phoneNumber}.</p>${unsubscribeLine(unsubscribeToken)}`,
    smsBody: `KinKeepers: we have your information. We'll be in touch within three business days. Questions? Call ${COPY.support.phoneNumber}. Reply STOP to stop texts.`,
    logContext: { applicant_id: applicantId, notification: "application_received" },
  });
}

/**
 * X3 message 2/7: fires from lib/admin/assignment.ts's
 * assignApplicantToCohortAction(). Facilitator first name is
 * deliberately omitted, not blank-filled - no facilitator display name
 * exists anywhere in the schema yet (profiles has no name column), same
 * gap and same "skip the line entirely" treatment lib/data.ts's own
 * getAssignedSessionForApplicant already uses for the on-screen status
 * page. "What to expect" reuses L4's existing
 * COPY.applicant.assigned.what_to_expect verbatim rather than drafting
 * new copy that says the same thing a second way.
 */
export async function notifyCohortAssigned(admin: SupabaseClient, applicantId: string, cohortId: string): Promise<void> {
  const applicant = await getApplicantContact(admin, applicantId);
  if (!applicant) return;
  const { contact, timeZone, unsubscribeToken } = applicant;

  const { data: cohort, error: cohortError } = await admin
    .from("cohorts")
    .select("time_zone")
    .eq("id", cohortId)
    .single();
  if (cohortError) throw cohortError;

  const { data: session, error: sessionError } = await admin
    .from("sessions")
    .select("scheduled_at, video_join_url, video_dial_in_number, video_dial_in_pin")
    .eq("cohort_id", cohortId)
    .eq("session_number", 1)
    .maybeSingle();
  if (sessionError) throw sessionError;
  // A cohort with no scheduled session 1 yet (e.g. Zoom creation failed
  // and it's still in draft - CLAUDE.md's own named case) has nothing
  // concrete to tell this member yet - honest to send nothing rather
  // than a welcome message missing the one thing it's for.
  if (!session) return;

  const timeDescription = describeInstantForMember(new Date(session.scheduled_at), timeZone, cohort.time_zone);
  const joinLine = session.video_join_url ? ` Join by video: ${session.video_join_url}.` : "";
  const dialInLine = session.video_dial_in_number
    ? ` Or call in: ${session.video_dial_in_number}${session.video_dial_in_pin ? ` (PIN ${session.video_dial_in_pin})` : ""}.`
    : "";
  const whatToExpect = COPY.applicant.assigned.what_to_expect;

  await notifyMember({
    admin,
    applicantId,
    notificationType: "cohort_assigned",
    dedupKey: `${applicantId}:cohort_assigned:${cohortId}`,
    contact,
    subject: "KinKeepers: your first session is set",
    emailHtml: `<p>Your first session is ${timeDescription}.${joinLine}${dialInLine}</p><p>${whatToExpect}</p><p>Questions? Call ${COPY.support.phoneNumber}.</p>${unsubscribeLine(unsubscribeToken)}`,
    smsBody: `KinKeepers: your first session is ${timeDescription}.${joinLine}${dialInLine} Questions? Call ${COPY.support.phoneNumber}. Reply STOP to stop texts.`,
    logContext: { applicant_id: applicantId, cohort_id: cohortId, notification: "cohort_assigned" },
  });
}

/**
 * X3 message 6/7: fires from lib/admin/cohort-completion.ts's
 * markCohortCompletedAction(), once per member whose status the new
 * applicants cascade (20260903100000) just moved to 'completed'. Reuses
 * L4's existing COPY.applicant.complete.body_no_next verbatim - it
 * already satisfies "warm, brief, names what comes next if anything
 * does" for the no-next-program case, the only one L4 built.
 */
export async function notifyProgramComplete(
  admin: SupabaseClient,
  cohortId: string,
  programName: string | null,
): Promise<void> {
  const { data: members, error } = await admin
    .from("applicants")
    .select("id, email, phone, preferred_contact_channel, notification_unsubscribe_token, notifications_opted_out")
    .eq("cohort_id", cohortId)
    .eq("status", "completed");
  if (error) throw error;

  const body = format(COPY.applicant.complete.body_no_next, { program: programName ?? "" });

  await Promise.all(
    members
      .filter((member) => !member.notifications_opted_out)
      .map((member) =>
        notifyMember({
          admin,
          applicantId: member.id,
          notificationType: "program_complete",
          dedupKey: `${member.id}:program_complete:${cohortId}`,
          contact: {
            email: member.email,
            phone: member.phone,
            preferredContactChannel: member.preferred_contact_channel,
          },
          subject: "KinKeepers: you've completed the program",
          emailHtml: `<p>${body}</p><p>Questions? Call ${COPY.support.phoneNumber}.</p>${unsubscribeLine(member.notification_unsubscribe_token)}`,
          smsBody: `KinKeepers: ${body} Questions? Call ${COPY.support.phoneNumber}. Reply STOP to stop texts.`,
          logContext: { applicant_id: member.id, cohort_id: cohortId, notification: "program_complete" },
        }),
      ),
  );
}
