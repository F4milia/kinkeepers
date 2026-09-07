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

// L4 audit gap-closure: the run doc's own prompt text is explicit -
// "Offer the 800 number. Someone waiting three weeks may need to talk to
// a person now" - for both of these two states specifically. The header's
// "Get help now" button already reaches it in one click (e2e-tested
// separately), but that's not literal static text on the page itself.
// Same plain-text treatment error-state.tsx already gives it, reusing
// the same copy key rather than a near-duplicate.
function CallForHelpLine() {
  return (
    <p className="text-meta font-ui text-ink-soft">
      {format(COPY.errors.call_for_help, { phoneNumber: COPY.support.phoneNumber })}
    </p>
  );
}

function WaitingForReview() {
  return (
    <Card className="flex flex-col items-center gap-2">
      <EmptyState
        headline={COPY.applicant.waiting_review.headline}
        body={COPY.applicant.waiting_review.body}
      />
      <CallForHelpLine />
    </Card>
  );
}

function Waitlisted({ applicant }: { applicant: Applicant }) {
  return (
    <Card className="flex flex-col items-center gap-2">
      <EmptyState
        headline={COPY.applicant.waitlisted.headline}
        body={format(COPY.applicant.waitlisted.body, {
          grouping: applicant.waitlistGroupingLabel ?? "",
          meetingTime: applicant.meetingTimeLabel ?? "",
        })}
      />
      <CallForHelpLine />
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
  const body = applicant.nextProgramName
    ? format(COPY.applicant.complete.body_with_next, {
        program: applicant.completedProgramName ?? "",
        nextProgram: applicant.nextProgramName,
      })
    : format(COPY.applicant.complete.body_no_next, {
        program: applicant.completedProgramName ?? "",
      });

  return (
    <Card>
      <EmptyState headline={COPY.applicant.complete.headline} body={body} />
    </Card>
  );
}
