import { notFound } from "next/navigation";
import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { getApplicantById } from "@/lib/admin/applicants";
import { listOpenCohortsForApplicant } from "@/lib/admin/assignment";
import { AssignApplicantButton } from "@/components/admin/assign-applicant-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

function applicantDisplayName(a: { firstName: string | null; lastName: string | null }): string {
  return [a.firstName, a.lastName].filter(Boolean).join(" ") || "Unnamed applicant";
}

function formatComposition(composition: { relationship: string | null; careRecipientStage: string | null; count: number }[]): string {
  if (composition.length === 0) return "No one enrolled yet";
  return composition
    .map((g) => `${g.count} ${g.relationship ?? "unspecified relationship"} / ${g.careRecipientStage ?? "unspecified stage"}`)
    .join(", ");
}

// Admin-only, narrower than app/admin/layout.tsx's allowed set - see
// app/admin/partners/new/page.tsx's comment for why this needs its own
// requireRoleOrRefuse rather than relying on the layout alone.
export default async function ApplicantAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const result = await requireRoleOrRefuse(["admin"]);
  if ("refusal" in result) return result.refusal;

  const { id } = await params;
  const applicant = await getApplicantById(id);
  if (!applicant) notFound();

  const openCohorts = await listOpenCohortsForApplicant(applicant.timeZone);

  return (
    <div className="max-w-3xl">
      <h1 className="text-h1 font-heading text-ink">{applicantDisplayName(applicant)}</h1>
      <p className="mt-2 text-body font-ui text-ink-soft">
        {applicant.relationship ?? "Relationship not given"} · {applicant.careRecipientStage ?? "stage not given"} ·{" "}
        {applicant.timeZone ?? "time zone not given"} · {applicant.daysWaiting}{" "}
        {applicant.daysWaiting === 1 ? "day" : "days"} waiting
      </p>

      <h2 className="mt-8 text-h3 font-heading text-ink">Open cohorts</h2>
      {applicant.status !== "pending_review" ? (
        <p className="mt-2 text-meta font-ui text-ink-soft">
          This applicant is no longer awaiting review (current status: {applicant.status}) - assignment
          isn&apos;t available.
        </p>
      ) : openCohorts.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            headline="No open cohorts"
            body="No cohort currently has room. Add this applicant to the waitlist by leaving them in the review queue."
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {openCohorts.map((cohort) => (
            <li key={cohort.id}>
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-body font-ui font-medium text-ink">{cohort.name}</p>
                    <p className="text-meta font-ui text-ink-soft">{cohort.groupingDescription}</p>
                    <p className="mt-1 text-meta font-ui text-ink-soft">{cohort.meetingDescription}</p>
                    <p className="mt-1 text-meta font-ui text-ink-soft">
                      Composition: {formatComposition(cohort.composition)}
                    </p>
                    <p className="text-meta font-ui text-ink-soft">
                      {cohort.remainingCapacity} of {cohort.capacity} spots open
                    </p>
                  </div>
                  {applicant.status === "pending_review" ? (
                    <AssignApplicantButton applicantId={applicant.id} cohortId={cohort.id} />
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
