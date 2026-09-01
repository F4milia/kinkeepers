import { ErrorState } from "@/components/ui/error-state";

/** notFound() target for every (caregiver) screen (e.g. a session id that doesn't exist, or resolve to another cohort). */
export default function CaregiverNotFound() {
  return <ErrorState variant="not_found" />;
}
