import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { COPY, format } from "@/lib/copy";
import { getSession, getSessionPrepRoster, getSessionPrepMaterials } from "@/lib/data";
import { formatSessionDay } from "@/lib/format-date";

// F3 | roster (with real attendance counts, never per-member notes) and
// certification-gated materials for the facilitator's own upcoming
// session. Materials fail independently of the roster (a try/catch here,
// not one Promise.all with the roster fetch) because an uncertified
// owning facilitator can still legitimately reach this page and see who's
// coming - get_session_prep_roster has no certification check - even
// though get_session_prep_materials throws for them. Letting that throw
// escape to the route's error.tsx would blank the whole page, including
// the roster that loaded fine, over a materials-specific block - not what
// this screen should do. The caught state renders the same generic
// COPY.error.load_failed every other data failure in this app uses
// (lib/data-errors.ts's own comment explains why this codebase doesn't
// try to distinguish *why* a fetch failed) - specifically NOT
// empty_materials, which would falsely claim zero materials exist rather
// than "you can't see them right now."
export default async function SessionPrepPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  const roster = await getSessionPrepRoster(sessionId);

  let materials: Awaited<ReturnType<typeof getSessionPrepMaterials>> = [];
  let materialsUnavailable = false;
  try {
    materials = await getSessionPrepMaterials(sessionId);
  } catch {
    materialsUnavailable = true;
  }

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-h2">{COPY.facilitator.prep.title}</h1>
      {session ? (
        <p className="text-body font-ui text-ink-soft">
          {formatSessionDay(session.date)} · {session.time} {session.timeZoneLabel}
        </p>
      ) : null}

      <section aria-labelledby="prep-roster-heading" className="flex flex-col gap-3">
        <h2 id="prep-roster-heading" className="text-h3">
          {COPY.facilitator.prep.roster_title}
        </h2>
        {roster.length === 0 ? (
          <p className="text-body font-ui text-ink-soft">{COPY.facilitator.prep.empty_roster}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {roster.map((member) => (
              <li key={member.applicantId}>
                <Card className="flex items-center justify-between gap-4">
                  <p className="text-body font-ui font-medium text-ink">{member.firstName}</p>
                  <p className="text-meta font-ui text-ink-soft">
                    {format(COPY.facilitator.prep.attended_label, { n: member.sessionsAttended })}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="prep-materials-heading" className="flex flex-col gap-3">
        <h2 id="prep-materials-heading" className="text-h3">
          {COPY.facilitator.prep.materials_title}
        </h2>
        {materialsUnavailable ? (
          <Card>
            <EmptyState headline={COPY.facilitator.prep.materials_title} body={COPY.error.load_failed} />
          </Card>
        ) : materials.length === 0 ? (
          <Card>
            <EmptyState
              headline={COPY.facilitator.prep.materials_title}
              body={COPY.facilitator.prep.empty_materials}
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {materials.map((material) => (
              <li key={material.id}>
                <Card>
                  <p className="text-body font-ui font-medium text-ink">{material.title}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
