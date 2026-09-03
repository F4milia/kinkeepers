import { ErrorState } from "@/components/ui/error-state";
import { getCurrentRole, roleHomePath } from "@/lib/auth/roles";

/**
 * notFound() target for every (caregiver) screen - a genuinely missing
 * resource for a real member (e.g. a session id that doesn't exist), or
 * a facilitator/admin/partner_staff hitting "/" (getViewer() 404s them,
 * since "/" is keyed off an applicant row they don't have). "Go to Home"
 * must resolve from the visitor's own role, not assume "/" - a
 * non-member here would otherwise loop straight back to this same page.
 */
export default async function CaregiverNotFound() {
  const role = await getCurrentRole();
  return <ErrorState variant="not_found" homeHref={roleHomePath(role)} />;
}
