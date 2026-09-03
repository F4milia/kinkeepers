"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";
import { describeCohortMeetingForApplicant } from "@/lib/admin/cohort-meeting-time";
import type { ApplicantMutationResult } from "@/lib/admin/applicants";
import { notifyCohortAssigned } from "@/lib/messaging/applicant-notifications";
import { notifyBestEffort } from "@/lib/messaging/notify-best-effort";

export interface CompositionGroup {
  relationship: string | null;
  careRecipientStage: string | null;
  count: number;
}

export interface OpenCohortOption {
  id: string;
  name: string;
  groupingDescription: string;
  capacity: number;
  remainingCapacity: number;
  composition: CompositionGroup[];
  meetingDescription: string;
}

/**
 * Every open cohort (has room), with composition and remaining capacity,
 * for the assignment picker - A2 spec: "For each applicant, show every
 * open cohort with: its grouping, current composition ..., remaining
 * capacity, cadence and meeting time in the APPLICANT's time zone."
 * Deliberately no ranking/suggestion - the reviewer sees all open
 * cohorts and decides; CLAUDE.md invariant #5 ("no auto-matcher").
 */
export async function listOpenCohortsForApplicant(
  applicantTimeZone: string | null,
  callerClient?: SupabaseClient,
): Promise<OpenCohortOption[]> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();

  const { data: cohorts, error: cohortsError } = await admin
    .from("cohorts")
    .select("id, name, grouping_description, capacity, meeting_day_of_week, meeting_time, time_zone");
  if (cohortsError) throw cohortsError;

  const { data: occupants, error: occupantsError } = await admin
    .from("applicants")
    .select("cohort_id, relationship, care_recipient_stage, status")
    .not("cohort_id", "is", null);
  if (occupantsError) throw occupantsError;

  // Filtered in JS, not via a Postgres "not in" filter - two literal
  // exclusions don't need supabase-js's less-obvious not.in syntax.
  const activeOccupants = occupants.filter((o) => o.status !== "declined" && o.status !== "withdrawn");

  return cohorts
    .map((cohort) => {
      const cohortOccupants = activeOccupants.filter((o) => o.cohort_id === cohort.id);

      const compositionMap = new Map<string, CompositionGroup>();
      for (const occupant of cohortOccupants) {
        const key = `${occupant.relationship ?? ""}|${occupant.care_recipient_stage ?? ""}`;
        const existing = compositionMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          compositionMap.set(key, {
            relationship: occupant.relationship,
            careRecipientStage: occupant.care_recipient_stage,
            count: 1,
          });
        }
      }

      return {
        id: cohort.id,
        name: cohort.name,
        groupingDescription: cohort.grouping_description,
        capacity: cohort.capacity,
        remainingCapacity: cohort.capacity - cohortOccupants.length,
        composition: Array.from(compositionMap.values()),
        meetingDescription: describeCohortMeetingForApplicant(
          {
            meetingDayOfWeek: cohort.meeting_day_of_week,
            meetingTime: cohort.meeting_time,
            timeZone: cohort.time_zone,
          },
          applicantTimeZone ?? cohort.time_zone,
        ),
      };
    })
    .filter((cohort) => cohort.remainingCapacity > 0);
}

export async function assignApplicantToCohortAction(
  applicantId: string,
  cohortId: string,
  callerClient?: SupabaseClient,
): Promise<ApplicantMutationResult> {
  const { userId } = await requireRole(["admin"], callerClient);
  const admin = createAdminClient();
  const { error } = await admin.rpc("assign_applicant_to_cohort", {
    actor_id: userId,
    target_applicant_id: applicantId,
    target_cohort_id: cohortId,
  });

  if (error) return { success: false, error: "Something went wrong. Try again." };

  // X3 message 2/7. Best-effort, same reasoning as every other
  // notification wired into an admin mutation this way.
  await notifyBestEffort(
    () => notifyCohortAssigned(admin, applicantId, cohortId),
    "applicant_notification_failed",
    { applicant_id: applicantId, cohort_id: cohortId },
  );

  revalidatePath("/admin/applicants");
  // Redirect rather than leaving the reviewer on this now-stale detail
  // page - the applicant is enrolled and no longer awaiting review, so
  // there's nothing left to do here.
  redirect("/admin/applicants");
}
