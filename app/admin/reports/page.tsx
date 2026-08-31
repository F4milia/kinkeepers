import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { getCohortDeliverySummary, getPartnerReferralSummary } from "@/lib/admin/reports";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_BADGE: Record<string, "neutral" | "accent" | "gentle"> = {
  draft: "gentle",
  active: "accent",
  completed: "neutral",
  cancelled: "neutral",
  pending_review: "accent",
  enrolled: "neutral",
  declined: "neutral",
};

// A5 (Wave 7). Attendance summaries are explicitly out of scope here -
// there is no attendance table yet, and real attendance pre-fill depends
// on X4 (Wave 9, Zoom participant-report E.164 matching), which hasn't
// been built. This covers exactly what's answerable from A3's schema
// today: session delivery status for admin, referral status for
// partner_staff (the "partner export" named in CLAUDE.md invariant #8).
export default async function AdminReportsPage() {
  const result = await requireRoleOrRefuse(["admin", "partner_staff"]);
  if ("refusal" in result) return result.refusal;

  if (result.role === "partner_staff") {
    const referrals = await getPartnerReferralSummary();
    return (
      <div className="max-w-3xl">
        <h1 className="text-h1 font-heading text-ink">Reports</h1>
        <p className="mt-2 text-body font-ui text-ink-soft">Your organization&apos;s referrals and their status.</p>

        {referrals.length === 0 ? (
          <div className="mt-6">
            <EmptyState headline="No referrals yet" body="Referrals your organization sends will appear here." />
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {referrals.map((referral) => (
              <li key={referral.id}>
                <Card>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-body font-ui font-medium text-ink">
                        {referral.firstName ?? "Unnamed"} {referral.lastName ?? ""}
                      </p>
                      <p className="text-meta font-ui text-ink-soft">
                        {referral.partnerReferenceId ? `Your reference: ${referral.partnerReferenceId}` : "No reference on file"}
                        {referral.cohortName ? ` · ${referral.cohortName}` : ""}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[referral.status] ?? "neutral"}>{referral.status}</Badge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const cohorts = await getCohortDeliverySummary();
  return (
    <div className="max-w-3xl">
      <h1 className="text-h1 font-heading text-ink">Reports</h1>
      <p className="mt-2 text-body font-ui text-ink-soft">Delivery status across every cohort.</p>

      {cohorts.length === 0 ? (
        <div className="mt-6">
          <EmptyState headline="No cohorts yet" body="Delivery summaries will appear here once a cohort exists." />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {cohorts.map((cohort) => (
            <li key={cohort.id}>
              <Card>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-body font-ui font-medium text-ink">{cohort.name}</p>
                    <p className="text-meta font-ui text-ink-soft">
                      {cohort.sessionsCompleted} completed · {cohort.sessionsScheduled} scheduled ·{" "}
                      {cohort.sessionsCancelled} cancelled
                    </p>
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
