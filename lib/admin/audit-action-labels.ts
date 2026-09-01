// Plain sync helpers - not "use server" (that file, audit-log.ts, may
// only export async functions - same split already established for
// lib/admin/decline-reasons.ts and lib/admin/days-waiting.ts).

// Every audit_action value ever defined, across every migration - plain-
// English labels so the log reads clearly to someone with no context on
// this codebase's own action names. A value with no entry here (should
// only happen for one added after this file, before this file catches
// up) falls back to a de-slugged version of the raw name - see
// labelForAction - never a raw enum string on its own.
const ACTION_LABELS: Record<string, string> = {
  admin_sign_in_link_issued: "Admin issued a sign-in link",
  cohort_assignment: "Applicant assigned to cohort",
  attendance_edit: "Attendance corrected",
  deletion_fulfillment: "Deletion fulfilled",
  role_change: "Role changed",
  partner_organization_created: "Partner organization created",
  partner_organization_updated: "Partner organization updated",
  applicant_assigned: "Applicant assigned to cohort",
  applicant_declined: "Applicant declined",
  applicant_reopened: "Applicant reopened",
  cohort_created: "Cohort created",
  cohort_creation_failed: "Cohort creation failed",
  session_rescheduled: "Session rescheduled",
  session_cancelled: "Session cancelled",
  session_substitution_recorded: "Substitute facilitator recorded",
  cohort_completed: "Cohort marked completed",
  member_data_request_fulfilled: "Data request fulfilled",
};

export function labelForAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export const AUDIT_LOG_SUBJECT_TYPES = [
  "applicant",
  "cohort",
  "session",
  "partner_organization",
  "member_data_request",
  "member",
] as const;
