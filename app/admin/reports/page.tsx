import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { EmptyState } from "@/components/ui/empty-state";

// Placeholder - the real reporting screen is A5's (Wave 7). Same reasoning
// as app/admin/cohorts/page.tsx: an honest "not built yet" route beats a
// dead nav link or a 404, and lets nav visibility per role be tested now.
//
// Narrower than the layout's allowed set (excludes facilitator) - uses
// requireRoleOrRefuse rather than requireRole so a facilitator hitting
// this URL directly gets the refusal UI, not an unhandled error (see
// that helper's comment for why the layout's own try/catch can't cover
// this).
export default async function AdminReportsPage() {
  const result = await requireRoleOrRefuse(["admin", "partner_staff"]);
  if ("refusal" in result) return result.refusal;

  return (
    <EmptyState
      headline="Reports"
      body="Reporting isn't built yet. This will show delivery and attendance summaries for your organization."
    />
  );
}
