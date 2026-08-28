// Split out of lib/admin/applicants.ts: a "use server" file may only
// export async functions - a plain constant like this one breaks the
// build ("A 'use server' file can only export async functions, found
// object").
export type DeclineReason = "not_a_fit" | "unresponsive" | "ineligible" | "duplicate" | "other";

export const DECLINE_REASONS: { value: DeclineReason; label: string }[] = [
  { value: "not_a_fit", label: "Not a fit for any current or planned group" },
  { value: "unresponsive", label: "Couldn't reach them" },
  { value: "ineligible", label: "Doesn't meet program eligibility" },
  { value: "duplicate", label: "Duplicate of another applicant" },
  { value: "other", label: "Other" },
];
