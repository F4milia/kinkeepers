import { notFound } from "next/navigation";
import { getCohortDetail, listFacilitators } from "@/lib/admin/cohorts";
import { formatMeetingTime } from "@/lib/admin/cohort-meeting-time";
import { requireRole } from "@/lib/auth/roles";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionActions } from "@/components/admin/session-actions";
import { MarkCohortCompletedButton } from "@/components/admin/mark-cohort-completed-button";

const STATUS_BADGE: Record<string, "neutral" | "accent" | "gentle"> = {
  draft: "gentle",
  active: "accent",
  completed: "neutral",
  cancelled: "neutral",
  scheduled: "accent",
  completed_session: "neutral",
};

// requireRole is only called here (unlike the list page) to branch on
// role: session reschedule/cancel/substitution is admin-only, so a
// facilitator or partner_staff viewer (both allowed to view this same
// page, per app/admin/layout.tsx) must not see those controls at all -
// getCohortDetail() itself still scopes by the caller's own RLS.
export default async function CohortDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cohort, { role }] = await Promise.all([
    getCohortDetail(id),
    requireRole(["admin", "facilitator", "partner_staff"]),
  ]);
  if (!cohort) notFound();
  const facilitators = role === "admin" ? await listFacilitators() : [];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-h1 font-heading text-ink">{cohort.name}</h1>
        <Badge variant={STATUS_BADGE[cohort.status] ?? "neutral"}>{cohort.status}</Badge>
      </div>
      <p className="mt-2 text-body font-ui text-ink-soft">{cohort.groupingDescription}</p>
      <p className="mt-1 text-meta font-ui text-ink-soft">
        {cohort.programName ?? "No program"} · {cohort.facilitatorEmail ?? "No facilitator"} ·{" "}
        {cohort.deliveryFormat === "in_person" ? "In person" : "Video"} · Capacity {cohort.capacity}
      </p>

      {cohort.zoomSetupError ? (
        <p className="mt-4 text-body font-ui text-ink">
          Zoom setup failed: {cohort.zoomSetupError}. This cohort has no sessions yet.
        </p>
      ) : null}

      {role === "admin" && cohort.status === "active" ? (
        <div className="mt-4">
          <MarkCohortCompletedButton cohortId={cohort.id} cohortName={cohort.name} />
        </div>
      ) : null}

      <h2 className="mt-8 text-h3 font-heading text-ink">Sessions</h2>
      {cohort.sessions.length === 0 ? (
        <p className="mt-2 text-meta font-ui text-ink-soft">No sessions scheduled yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {cohort.sessions.map((session) => (
            <li key={session.id}>
              <Card>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-body font-ui font-medium text-ink">
                      Session {session.sessionNumber} ·{" "}
                      {formatMeetingTime(new Date(session.scheduledAt), cohort.timeZone)}
                    </p>
                    {session.substituteFacilitatorEmail ? (
                      <p className="text-meta font-ui text-ink-soft">
                        Substitute facilitator: {session.substituteFacilitatorEmail}
                      </p>
                    ) : null}
                    {session.cancellationReason ? (
                      <p className="text-meta font-ui text-ink-soft">Cancelled: {session.cancellationReason}</p>
                    ) : null}
                    {session.videoJoinUrl ? (
                      <a
                        href={session.videoJoinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-meta font-ui text-action underline"
                      >
                        Join link
                      </a>
                    ) : null}
                  </div>
                  <Badge variant={STATUS_BADGE[session.status] ?? "neutral"}>{session.status}</Badge>
                </div>
                {role === "admin" && session.status === "scheduled" ? (
                  <SessionActions
                    sessionId={session.id}
                    scheduledAt={session.scheduledAt}
                    timeZone={cohort.timeZone}
                    facilitators={facilitators}
                    currentSubstituteFacilitatorId={session.substituteFacilitatorId}
                  />
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
