import { requireRole, UnauthenticatedError, ForbiddenError } from "@/lib/auth/roles";
import { AdminShell } from "@/components/admin/admin-shell";
import { AccessRefused } from "@/components/admin/access-refused";

// Outer boundary for every /admin/* route. requireRole resolves role
// server-side from the database (never a client claim, per CLAUDE.md
// invariant #9) and throws rather than silently redirecting - caught
// here so a refusal renders instead of an unhandled error page/blank
// screen, per A1's "direct URL access to an unpermitted route returns
// a refusal" acceptance criterion.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    const { role } = await requireRole(["admin", "facilitator", "partner_staff"]);
    return <AdminShell role={role}>{children}</AdminShell>;
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return <AccessRefused reason="signed_out" />;
    }
    if (error instanceof ForbiddenError) {
      return <AccessRefused reason="wrong_role" />;
    }
    throw error;
  }
}
