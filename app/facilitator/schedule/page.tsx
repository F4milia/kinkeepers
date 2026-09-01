import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { COPY, format } from "@/lib/copy";
import { getFacilitatorCohorts, getFacilitatorSchedule, type FacilitatorScheduleSession } from "@/lib/data";
import type { Cohort } from "@/lib/types";
import { daysSince, formatSessionDay } from "@/lib/format-date";

function LogStatus({ session }: { session: FacilitatorScheduleSession }) {
  if (session.deliveryConfirmed) {
    return <Badge variant="accent">{COPY.facilitator.schedule.logged}</Badge>;
  }
  const overdue = daysSince(session.date);
  return (
    <Badge variant="gentle">
      {overdue === 1
        ? COPY.facilitator.schedule.not_logged_one
        : format(COPY.facilitator.schedule.not_logged_many, { n: overdue })}
    </Badge>
  );
}

function ScheduleRow({
  session,
  sessionsById,
  cohortsById,
}: {
  session: FacilitatorScheduleSession;
  sessionsById: Map<string, FacilitatorScheduleSession>;
  cohortsById: Map<string, Cohort>;
}) {
  const cohort = cohortsById.get(session.cohortId);

  return (
    <li>
      <Card className="flex flex-col gap-2">
        <p className="text-meta font-ui text-ink-soft">{cohort?.name}</p>
        <p className="text-body font-ui font-medium text-ink">
          {formatSessionDay(session.date)} · {session.time} {session.timeZoneLabel}
        </p>
        <div className="flex flex-wrap gap-2">
          {session.status === "past" && <LogStatus session={session} />}
          {session.overlapsSessionIds.map((otherId) => {
            const otherCohort = cohortsById.get(sessionsById.get(otherId)?.cohortId ?? "");
            return (
              <Badge key={otherId} variant="gentle">
                {format(COPY.facilitator.schedule.overlaps_with, { cohortName: otherCohort?.name ?? "" })}
              </Badge>
            );
          })}
        </div>
      </Card>
    </li>
  );
}

// F1 Schedule | every session across the facilitator's cohorts,
// chronological, split into upcoming/past per the prompt. Overlaps flagged
// on whichever sessions collide, in either section.
export default async function FacilitatorSchedulePage() {
  const [schedule, cohorts] = await Promise.all([getFacilitatorSchedule(), getFacilitatorCohorts()]);
  const sessionsById = new Map(schedule.map((session) => [session.id, session]));
  const cohortsById = new Map(cohorts.map((cohort) => [cohort.id, cohort]));
  const upcoming = schedule.filter((session) => session.status === "upcoming");
  const past = schedule.filter((session) => session.status === "past");

  if (schedule.length === 0) {
    return (
      <Card>
        <EmptyState headline={COPY.facilitator.schedule.title} body={COPY.facilitator.schedule.empty} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-h2">{COPY.facilitator.schedule.title}</h1>

      <section aria-labelledby="upcoming-heading" className="flex flex-col gap-3">
        <h2 id="upcoming-heading" className="text-h3">
          {COPY.facilitator.schedule.upcoming}
        </h2>
        <ul className="flex flex-col gap-3">
          {upcoming.map((session) => (
            <ScheduleRow key={session.id} session={session} sessionsById={sessionsById} cohortsById={cohortsById} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="past-heading" className="flex flex-col gap-3">
        <h2 id="past-heading" className="text-h3">
          {COPY.facilitator.schedule.past}
        </h2>
        <ul className="flex flex-col gap-3">
          {past.map((session) => (
            <ScheduleRow key={session.id} session={session} sessionsById={sessionsById} cohortsById={cohortsById} />
          ))}
        </ul>
      </section>
    </div>
  );
}
