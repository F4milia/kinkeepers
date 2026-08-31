import { notFound } from "next/navigation";
import { getCohortDetail } from "@/lib/admin/cohorts";
import { formatMeetingTime } from "@/lib/admin/cohort-meeting-time";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_BADGE: Record<string, "neutral" | "accent" | "gentle"> = {
  draft: "gentle",
  active: "accent",
  completed: "neutral",
  cancelled: "neutral",
  scheduled: "accent",
  completed_session: "neutral",
};

// No requireRole call here - same reasoning as app/admin/cohorts/page.tsx:
// this page's allowed set matches the layout's exactly, and
// getCohortDetail() scopes by the caller's own RLS.
export default async function CohortDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cohort = await getCohortDetail(id);
  if (!cohort) notFound();

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
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
