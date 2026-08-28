import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { COPY, format } from "@/lib/copy";
import {
  getCohort,
  getFacilitatorCohorts,
  getFacilitatorSessionsNeedingLog,
  getFacilitatorViewer,
  getNextFacilitatorSession,
} from "@/lib/data";
import { formatSessionDay } from "@/lib/format-date";

// F1 Home | next session (with join action), sessions needing a log
// (the nudge that keeps delivery evidence complete — second thing shown,
// per the prompt), then the facilitator's own cohorts with position.
export default function FacilitatorHomePage() {
  const viewer = getFacilitatorViewer();
  const nextSession = getNextFacilitatorSession();
  const nextSessionCohort = nextSession ? getCohort(nextSession.cohortId) : undefined;
  const needingLog = getFacilitatorSessionsNeedingLog();
  const cohorts = getFacilitatorCohorts();

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-h2">{format(COPY.home.greeting, { firstName: viewer.firstName })}</h1>

      <section aria-labelledby="next-session-heading" className="flex flex-col gap-3">
        <h2 id="next-session-heading" className="text-h3">
          {COPY.facilitator.home.next_session}
        </h2>
        {nextSession && nextSessionCohort ? (
          <Card className="flex flex-col items-start gap-3">
            <p className="text-meta font-ui text-ink-soft">{nextSessionCohort.name}</p>
            <p className="text-h2 font-heading">{formatSessionDay(nextSession.date)}</p>
            <p className="text-body-lg font-ui text-ink-soft">
              {nextSession.time} {nextSession.timeZoneLabel}
            </p>
            {nextSession.joinUrl ? (
              <a href={nextSession.joinUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("primary")}>
                {COPY.home.join_video}
              </a>
            ) : null}
          </Card>
        ) : (
          <Card>
            <EmptyState
              headline={COPY.facilitator.home.next_session}
              body={COPY.facilitator.home.empty_next_session}
            />
          </Card>
        )}
      </section>

      <section aria-labelledby="needs-log-heading" className="flex flex-col gap-3">
        <h2 id="needs-log-heading" className="text-h3">
          {COPY.facilitator.home.needs_log}
        </h2>
        {needingLog.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {needingLog.map((session) => {
              const cohort = getCohort(session.cohortId);
              return (
                <li key={session.id}>
                  <Card interactive href={`/session/${session.id}`}>
                    <p className="text-meta font-ui text-ink-soft">{cohort?.name}</p>
                    <p className="text-body font-ui font-medium text-ink">{formatSessionDay(session.date)}</p>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-body font-ui text-ink-soft">{COPY.facilitator.home.empty_needs_log}</p>
        )}
      </section>

      <section aria-labelledby="cohorts-heading" className="flex flex-col gap-3">
        <h2 id="cohorts-heading" className="text-h3">
          {COPY.facilitator.home.cohorts_title}
        </h2>
        <ul className="flex flex-col gap-3">
          {cohorts.map((cohort) => (
            <li key={cohort.id}>
              <Card>
                <p className="text-body font-ui font-medium text-ink">{cohort.name}</p>
                <p className="text-meta font-ui text-ink-soft">
                  {format(COPY.home.progress, { n: cohort.sessionNumber, total: cohort.sessionTotal })}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/facilitator/schedule"
        className="inline-flex min-h-12 w-fit items-center rounded-control px-4 text-label font-ui text-action hover:bg-action-dim active:bg-action-dim"
      >
        {COPY.facilitator.nav.schedule}
      </Link>
    </div>
  );
}
