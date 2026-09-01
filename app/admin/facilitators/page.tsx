import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { listFacilitatorsWithCertifications } from "@/lib/admin/facilitators";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

// Admin-only, narrower than app/admin/layout.tsx's allowed set - see
// app/admin/partners/new/page.tsx's comment for why this needs its own
// requireRoleOrRefuse rather than relying on the layout alone.
//
// Capacity, not payouts: "one facilitator running four cohorts is our
// intended model; one running nine is a quality problem before it's a
// scheduling problem" (A4-cert prompt). No payout screen or number
// exists here - that's A4-payouts, parked pending B1/B3.
export default async function FacilitatorsPage() {
  const result = await requireRoleOrRefuse(["admin"]);
  if ("refusal" in result) return result.refusal;

  const facilitators = await listFacilitatorsWithCertifications();

  if (facilitators.length === 0) {
    return (
      <EmptyState
        headline="No facilitators yet"
        body="Facilitator accounts are created through sign-in - none have signed in yet."
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-h1 font-heading text-ink">Facilitators</h1>
      <ul className="mt-6 flex flex-col gap-3">
        {facilitators.map((facilitator) => {
          const expired = facilitator.certifications.filter((c) => c.isExpired);
          const expiringSoon = facilitator.certifications.filter((c) => c.isExpiringSoon);
          return (
            <li key={facilitator.id}>
              <Card interactive href={`/admin/facilitators/${facilitator.id}`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-body font-ui font-medium text-ink">{facilitator.email}</p>
                    <p className="text-meta font-ui text-ink-soft">
                      {facilitator.activeCohortCount} active {facilitator.activeCohortCount === 1 ? "cohort" : "cohorts"}{" "}
                      · {facilitator.sessionsNext7Days} {facilitator.sessionsNext7Days === 1 ? "session" : "sessions"} in
                      the next 7 days
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {expired.length > 0 ? (
                      <Badge variant="urgent">
                        {expired.length} certification{expired.length === 1 ? "" : "s"} expired
                      </Badge>
                    ) : null}
                    {expiringSoon.length > 0 ? (
                      <Badge variant="gentle">
                        {expiringSoon.length} expiring within 60 days
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-meta font-ui text-ink-soft">
        Facilitator accounts appear automatically once someone signs in with the facilitator role.
      </p>
    </div>
  );
}
