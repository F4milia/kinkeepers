import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import {
  getCohortDeliverySummary,
  getPartnerReferralSummary,
  getUnloggedPastSessions,
  getConsecutiveAbsenceFlags,
} from "@/lib/admin/reports";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

// Admin-only oversight list, not a member-facing screen - shown as a
// real instant with an explicit zone name rather than lib/format-date.ts's
// formatSessionDay (which expects a bare "YYYY-MM-DD" fixture date, not a
// full sessions.scheduled_at timestamptz).
function formatScheduledInstant(scheduledAtISO: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZoneName: "short" }).format(
    new Date(scheduledAtISO),
  );
}

const STATUS_BADGE: Record<string, "neutral" | "accent" | "gentle"> = {
  draft: "gentle",
  active: "accent",
  completed: "neutral",
  cancelled: "neutral",
  pending_review: "accent",
  enrolled: "neutral",
  declined: "neutral",
};

// A5 (Wave 7). Attendance-derived sections (unlogged sessions,
// consecutive-absence flag) were added later, once X4 (Wave 9) built the
// actual session_logs/session_attendance tables this screen originally
// had nothing to read from - see the superseded note this replaced.
// Referral status stays partner_staff's own view (the "partner export"
// named in CLAUDE.md invariant #8); the rest is admin-only.
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

  const [cohorts, unloggedSessions, absenceFlags] = await Promise.all([
    getCohortDeliverySummary(),
    getUnloggedPastSessions(),
    getConsecutiveAbsenceFlags(),
  ]);

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

      <h2 className="mt-10 text-h3 font-heading text-ink">Needs a session log</h2>
      <p className="mt-2 text-meta font-ui text-ink-soft">
        Sessions that have already happened but the facilitator hasn&apos;t confirmed delivery/attendance for yet.
      </p>
      {unloggedSessions.length === 0 ? (
        <div className="mt-4">
          <EmptyState headline="Nothing outstanding" body="Every past session has a confirmed log." />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {unloggedSessions.map((session) => (
            <li key={session.id}>
              <Card>
                <p className="text-body font-ui font-medium text-ink">
                  {session.cohortName} — Session {session.sessionNumber}
                </p>
                <p className="text-meta font-ui text-ink-soft">{formatScheduledInstant(session.scheduledAt)}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-h3 font-heading text-ink">Two consecutive absences</h2>
      <p className="mt-2 text-meta font-ui text-ink-soft">
        Members whose two most recent logged sessions, back to back, were both marked absent. Signal only - no
        action is taken automatically.
      </p>
      {absenceFlags.length === 0 ? (
        <div className="mt-4">
          <EmptyState headline="None flagged" body="No member has two consecutive absences right now." />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {absenceFlags.map((flag) => (
            <li key={flag.applicantId}>
              <Card>
                <p className="text-body font-ui font-medium text-ink">
                  {[flag.firstName, flag.lastName].filter(Boolean).join(" ") || "Unnamed applicant"}
                </p>
                <p className="text-meta font-ui text-ink-soft">
                  {flag.cohortName} — missed sessions {flag.missedSessionNumbers[0]} and{" "}
                  {flag.missedSessionNumbers[1]}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
