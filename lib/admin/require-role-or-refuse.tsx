import { requireRole, UnauthenticatedError, ForbiddenError, type AppRole } from "@/lib/auth/roles";
import { AccessRefused } from "@/components/admin/access-refused";

/**
 * For a page whose own allowed set is narrower than app/admin/layout.tsx's
 * (e.g. /admin/reports excludes facilitator, but the layout admits it).
 * The layout's own try/catch only wraps ITS requireRole call - a throw
 * from a child page's Server Component isn't caught by the parent
 * layout's function body, so any page enforcing a narrower set than the
 * layout must catch its own refusal the same way, or a facilitator
 * hitting /admin/reports directly gets an unhandled error page instead
 * of the required refusal UI. Pages whose allowed set exactly matches
 * the layout's don't need this - the layout already covers them.
 */
export async function requireRoleOrRefuse(
  allowed: AppRole[],
): Promise<{ role: AppRole } | { refusal: React.ReactElement }> {
  try {
    const { role } = await requireRole(allowed);
    return { role };
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return { refusal: <AccessRefused reason="signed_out" /> };
    }
    if (error instanceof ForbiddenError) {
      return { refusal: <AccessRefused reason="wrong_role" /> };
    }
    throw error;
  }
}
