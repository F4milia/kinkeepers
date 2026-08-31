import Link from "next/link";
import { listCohorts } from "@/lib/admin/cohorts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

const STATUS_BADGE: Record<string, "neutral" | "accent" | "gentle"> = {
  draft: "gentle",
  active: "accent",
  completed: "neutral",
  cancelled: "neutral",
};

// No requireRole call here: this page's allowed set (admin, facilitator,
// partner_staff) is identical to app/admin/layout.tsx's, which already
// enforces it - see app/admin/cohorts's original stub comment for the
// same reasoning. listCohorts() itself scopes by the caller's own RLS
// (admin sees all, a facilitator sees only their own), so this list is
// already correct per-role without this page doing anything extra.
export default async function AdminCohortsPage() {
  const cohorts = await listCohorts();

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-h1 font-heading text-ink">Cohorts</h1>
        <Link href="/admin/cohorts/new" className={buttonClasses("primary")}>
          New cohort
        </Link>
      </div>

      {cohorts.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            headline="No cohorts yet"
            body="Create one to start scheduling sessions and assigning applicants."
          />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {cohorts.map((cohort) => (
            <li key={cohort.id}>
              <Card interactive href={`/admin/cohorts/${cohort.id}`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-body font-ui font-medium text-ink">{cohort.name}</p>
                    <p className="text-meta font-ui text-ink-soft">
                      {cohort.programName ?? "No program"} · {cohort.facilitatorEmail ?? "No facilitator"}
                    </p>
                    {cohort.zoomSetupError ? (
                      <p className="text-meta font-ui text-ink">Zoom setup failed: {cohort.zoomSetupError}</p>
                    ) : null}
                  </div>
                  <Badge variant={STATUS_BADGE[cohort.status] ?? "neutral"}>{cohort.status}</Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
