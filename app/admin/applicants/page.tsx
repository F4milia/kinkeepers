import Link from "next/link";
import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import {
  listPendingReviewApplicants,
  listDeclinedApplicants,
  type QueuedApplicant,
  type DeclinedApplicant,
} from "@/lib/admin/applicants";
import { listWaitlistSummary } from "@/lib/admin/waitlist";
import { DeclineApplicantButton } from "@/components/admin/decline-applicant-button";
import { ReopenApplicantButton } from "@/components/admin/reopen-applicant-button";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

function applicantDisplayName(a: { firstName: string | null; lastName: string | null }): string {
  return [a.firstName, a.lastName].filter(Boolean).join(" ") || "Unnamed applicant";
}

function ApplicantRow({ applicant, action }: { applicant: QueuedApplicant; action: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-4">
      <div>
        <p className="text-body font-ui font-medium text-ink">{applicantDisplayName(applicant)}</p>
        <p className="text-meta font-ui text-ink-soft">
          {applicant.relationship ?? "Relationship not given"} ·{" "}
          {applicant.careRecipientStage ?? "stage not given"} · {applicant.timeZone ?? "time zone not given"}
        </p>
        <p className="text-meta font-ui text-ink-soft">
          Referred via {applicant.referralSource === "partner_link" ? "partner link" : "staff form"} ·{" "}
          {applicant.daysWaiting} {applicant.daysWaiting === 1 ? "day" : "days"} waiting
        </p>
      </div>
      <div className="flex items-center gap-2">{action}</div>
    </li>
  );
}

// Admin-only, narrower than app/admin/layout.tsx's allowed set - see
// app/admin/partners/new/page.tsx's comment for why this needs its own
// requireRoleOrRefuse rather than relying on the layout alone.
export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const result = await requireRoleOrRefuse(["admin"]);
  if ("refusal" in result) return result.refusal;

  const { tab } = await searchParams;
  const activeTab = tab === "declined" ? "declined" : tab === "waitlist" ? "waitlist" : "pending";

  return (
    <div className="max-w-3xl">
      <h1 className="text-h1 font-heading text-ink">Applicants</h1>
      <nav aria-label="Applicant status" className="mt-4 flex gap-2 border-b border-line">
        <Link
          href="/admin/applicants"
          className={`min-h-12 px-4 py-3 text-label font-ui ${
            activeTab === "pending" ? "border-b-2 border-action text-ink" : "text-ink-soft"
          }`}
        >
          Pending review
        </Link>
        <Link
          href="/admin/applicants?tab=declined"
          className={`min-h-12 px-4 py-3 text-label font-ui ${
            activeTab === "declined" ? "border-b-2 border-action text-ink" : "text-ink-soft"
          }`}
        >
          Declined
        </Link>
        <Link
          href="/admin/applicants?tab=waitlist"
          className={`min-h-12 px-4 py-3 text-label font-ui ${
            activeTab === "waitlist" ? "border-b-2 border-action text-ink" : "text-ink-soft"
          }`}
        >
          Waitlist summary
        </Link>
      </nav>
      <div className="mt-6">
        {activeTab === "pending" ? (
          <PendingReviewList />
        ) : activeTab === "declined" ? (
          <DeclinedList />
        ) : (
          <WaitlistSummary />
        )}
      </div>
    </div>
  );
}

async function PendingReviewList() {
  const applicants = await listPendingReviewApplicants();

  if (applicants.length === 0) {
    return <EmptyState headline="Queue is empty" body="No applicants are currently waiting for review." />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {applicants.map((applicant) => (
        <ApplicantRow
          key={applicant.id}
          applicant={applicant}
          action={
            <>
              <Link href={`/admin/applicants/${applicant.id}`} className={buttonClasses("secondary")}>
                Review &amp; assign
              </Link>
              <DeclineApplicantButton applicantId={applicant.id} applicantName={applicantDisplayName(applicant)} />
            </>
          }
        />
      ))}
    </ul>
  );
}

async function DeclinedList() {
  const applicants: DeclinedApplicant[] = await listDeclinedApplicants();

  if (applicants.length === 0) {
    return <EmptyState headline="No declined applicants" body="Declined applicants will appear here." />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {applicants.map((applicant) => (
        <ApplicantRow
          key={applicant.id}
          applicant={applicant}
          action={<ReopenApplicantButton applicantId={applicant.id} />}
        />
      ))}
    </ul>
  );
}

async function WaitlistSummary() {
  const groups = await listWaitlistSummary();

  if (groups.length === 0) {
    return <EmptyState headline="No one waiting" body="Every pending applicant is already matched or in review." />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {groups.map((group) => (
        <li
          key={`${group.relationship ?? ""}|${group.careRecipientStage ?? ""}`}
          className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-4"
        >
          <div>
            <p className="text-body font-ui font-medium text-ink">
              {group.relationship ?? "Relationship not given"} · {group.careRecipientStage ?? "stage not given"}
            </p>
            <p className="text-meta font-ui text-ink-soft">
              Oldest wait: {group.daysWaiting} {group.daysWaiting === 1 ? "day" : "days"}
            </p>
          </div>
          <p className="text-h3 font-heading text-ink">{group.waitingCount}</p>
        </li>
      ))}
    </ul>
  );
}
