import { notFound } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { COPY, format } from "@/lib/copy";
import { getApplicant } from "@/lib/data";
import { formatSessionDay } from "@/lib/format-date";
import type { Applicant } from "@/lib/types";

// L4 | one route, four states, driven by Applicant.status (and
// hasMatchingCohort for the two pending_review variants). No gamification
// on the completed state per CLAUDE.md — no certificate, no celebration.
export default async function ApplicantStatusPage({
  params,
}: {
  params: Promise<{ applicantId: string }>;
}) {
  const { applicantId } = await params;
  const applicant = await getApplicant(applicantId);
  if (!applicant) notFound();

  if (applicant.status === "pending_review") {
    return applicant.hasMatchingCohort ? <WaitingForReview /> : <Waitlisted applicant={applicant} />;
  }

  if (applicant.status === "enrolled" && applicant.assignedSession) {
    return <AssignedBeforeSessionOne applicant={applicant} />;
  }

  if (applicant.status === "completed") {
    return <ProgramComplete applicant={applicant} />;
  }

  notFound();
}

function WaitingForReview() {
  return (
    <Card>
      <EmptyState
        headline={COPY.applicant.waiting_review.headline}
        body={COPY.applicant.waiting_review.body}
      />
    </Card>
  );
}

function Waitlisted({ applicant }: { applicant: Applicant }) {
  return (
    <Card>
      <EmptyState
        headline={COPY.applicant.waitlisted.headline}
        body={format(COPY.applicant.waitlisted.body, {
          grouping: applicant.waitlistGroupingLabel ?? "",
          meetingTime: applicant.meetingTimeLabel ?? "",
        })}
      />
    </Card>
  );
}

function AssignedBeforeSessionOne({ applicant }: { applicant: Applicant }) {
  const session = applicant.assignedSession;
  if (!session) notFound();

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-h2">{COPY.applicant.assigned.headline}</h1>

      <Card className="flex flex-col items-start gap-4">
        <div>
          <p className="text-h2 font-heading">{formatSessionDay(session.date)}</p>
          <p className="mt-1 text-body-lg font-ui text-ink-soft">
            {session.time} {session.timeZoneLabel}
          </p>
        </div>

        {session.facilitatorFirstName ? (
          <p className="text-body font-ui text-ink">
            {COPY.applicant.assigned.facilitator_label}: {session.facilitatorFirstName}
          </p>
        ) : null}

        {session.joinUrl ? (
          <a
            href={session.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonClasses("primary")} w-full`}
          >
            {COPY.home.join_video}
          </a>
        ) : (
          <Button variant="primary" className="w-full" disabled>
            {COPY.home.join_video}
          </Button>
        )}

        <p className="text-body font-ui text-ink-soft">
          {COPY.applicant.assigned.dial_in_label}: {session.dialInNumber} — PIN {session.dialInPin}
        </p>

        <p className="text-body font-ui text-ink-soft">{COPY.applicant.assigned.what_to_expect}</p>
      </Card>
    </div>
  );
}

function ProgramComplete({ applicant }: { applicant: Applicant }) {
  return (
    <Card>
      <EmptyState
        headline={COPY.applicant.complete.headline}
        body={format(COPY.applicant.complete.body_no_next, {
          program: applicant.completedProgramName ?? "",
        })}
      />
    </Card>
  );
}
