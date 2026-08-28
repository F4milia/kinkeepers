import { EmptyState } from "@/components/ui/empty-state";

// Placeholder - the real cohort management screen is A3's (Wave 4). This
// exists now so /admin/cohorts is an honest "not built yet" rather than a
// dead link in the nav, and so nav visibility per role can be built and
// tested today against a real route instead of one that 404s.
//
// No requireRole call here: this page's allowed set (admin, facilitator,
// partner_staff) is identical to app/admin/layout.tsx's, which already
// enforces it for every /admin/* route - a second identical check here
// would be dead code, never able to throw for anyone the layout let
// through. See app/admin/reports/page.tsx for the case where a page's
// set is narrower than the layout's and a repeated check is required.
export default function AdminCohortsPage() {
  return (
    <EmptyState
      headline="Cohorts"
      body="Cohort management isn't built yet. This will let you view and manage cohort membership and delivery."
    />
  );
}
