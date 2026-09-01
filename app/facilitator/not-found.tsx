import { ErrorState } from "@/components/ui/error-state";

/** notFound() target for /facilitator - also what a signed-in wrong-role visitor sees (see layout.tsx). */
export default function FacilitatorNotFound() {
  return <ErrorState variant="not_found" />;
}
