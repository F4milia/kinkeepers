import { ErrorState } from "@/components/ui/error-state";
import { getCurrentRole, roleHomePath } from "@/lib/auth/roles";

/**
 * notFound() target for /facilitator - also what a signed-in wrong-role
 * visitor sees (see layout.tsx). "Go to Home" must resolve from the
 * visitor's own role, not assume "/" (the caregiver home) - a facilitator
 * or admin landing here would otherwise loop straight back to this same
 * page, the exact dead-end CLAUDE.md's error-state rule forbids.
 */
export default async function FacilitatorNotFound() {
  const role = await getCurrentRole();
  return <ErrorState variant="not_found" homeHref={roleHomePath(role)} />;
}
