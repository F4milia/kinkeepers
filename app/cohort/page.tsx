import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { COPY, format } from "@/lib/copy";
import { getCohort, getCohortMembers, getViewer } from "@/lib/data";

// My group | Part 3.4: roster only — first name, avatar initials, role,
// relationship. No last names, no email, no phone: this is a
// face-recognition aid, not a directory. No row actions, read-only by
// design. The facilitator is labeled, not elevated to a hierarchy, so she
// gets the same row treatment as everyone else, just listed first.
export default function CohortPage() {
  const viewer = getViewer();
  const cohort = getCohort(viewer.cohortId);
  const members = getCohortMembers(viewer.cohortId);

  if (!cohort || members.length === 0) {
    return <EmptyState headline={COPY.cohort.title} body={COPY.cohort.empty} />;
  }

  const roster = [...members].sort((a, b) => {
    if (a.role === b.role) return 0;
    return a.role === "facilitator" ? -1 : 1;
  });

  return (
    <div className="flex flex-col gap-section">
      <div>
        <h1 className="text-h2">{COPY.cohort.title}</h1>
        <p className="mt-2 text-body-lg font-ui text-ink-soft">{cohort.grouping}</p>
        <p className="mt-1 text-meta font-ui text-ink-soft">
          {format(COPY.cohort.subtitle, { n: members.length, cadence: cohort.cadence })}
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {roster.map((member) => (
          <li key={member.id} className="flex items-center gap-4 py-4">
            <Avatar name={member.firstName} />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words text-label font-ui text-ink">{member.firstName}</p>
                {member.role === "facilitator" && (
                  <Badge variant="neutral">{COPY.cohort.facilitator_label}</Badge>
                )}
              </div>
              <p className="break-words text-meta font-ui text-ink-soft">
                {format(COPY.cohort.caring_for, { relationship: member.caringFor })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
