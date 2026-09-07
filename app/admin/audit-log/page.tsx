import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { listAuditLog } from "@/lib/admin/audit-log";
import { AUDIT_LOG_SUBJECT_TYPES, AUDIT_LOG_ACTIONS, labelForAction } from "@/lib/admin/audit-action-labels";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

const FIELD_CLASSES = "min-h-12 rounded-control border border-line bg-surface px-3 py-2 text-meta font-ui text-ink";

/**
 * submit_session_log()'s own metadata shape (supabase/migrations/
 * 20260902110000_session_attendance.sql) - the one action type this
 * page renders extra detail for, since A5's own acceptance line
 * specifically requires attendance corrections to be "visibly
 * corrections" with prior values preserved, not just proven at the DB
 * level. Loosely typed (no generated Supabase types exist in this
 * codebase) and narrowed defensively at the render site below.
 */
interface AttendanceChange {
  applicant_id?: string;
  previous_status?: string | null;
  new_status?: string;
}

function attendanceChanges(metadata: Record<string, unknown> | null): AttendanceChange[] {
  if (!metadata || metadata.is_correction !== true || !Array.isArray(metadata.attendance_changes)) return [];
  return metadata.attendance_changes as AttendanceChange[];
}

// Admin-only - audit_log's own migration comment: "A5 (Wave 7) owns the
// actual admin-facing screen and does its own role check there before
// querying." Filters are plain GET query params (no client JS) - same
// "no client component where a form submit will do" bias as the rest of
// this admin surface.
export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; subjectType?: string; actorEmail?: string; startDate?: string; endDate?: string }>;
}) {
  const result = await requireRoleOrRefuse(["admin"]);
  if ("refusal" in result) return result.refusal;

  const { action, subjectType, actorEmail, startDate, endDate } = await searchParams;
  const entries = await listAuditLog({ action, subjectType, actorEmail, startDate, endDate });
  const hasFilters = Boolean(action || subjectType || actorEmail || startDate || endDate);

  return (
    <div className="max-w-3xl">
      <h1 className="text-h1 font-heading text-ink">Audit log</h1>
      <p className="mt-2 text-body font-ui text-ink-soft">Every privileged action, most recent first.</p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="subjectType" className="text-meta font-ui text-ink-soft">
            Subject
          </label>
          <select id="subjectType" name="subjectType" defaultValue={subjectType ?? ""} className={FIELD_CLASSES}>
            <option value="">All</option>
            {AUDIT_LOG_SUBJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="action" className="text-meta font-ui text-ink-soft">
            Action
          </label>
          <select id="action" name="action" defaultValue={action ?? ""} className={FIELD_CLASSES}>
            <option value="">All</option>
            {AUDIT_LOG_ACTIONS.map((value) => (
              <option key={value} value={value}>
                {labelForAction(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="actorEmail" className="text-meta font-ui text-ink-soft">
            Actor
          </label>
          <input
            id="actorEmail"
            name="actorEmail"
            defaultValue={actorEmail ?? ""}
            placeholder="email contains…"
            className={FIELD_CLASSES}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="startDate" className="text-meta font-ui text-ink-soft">
            From
          </label>
          <input id="startDate" name="startDate" type="date" defaultValue={startDate ?? ""} className={FIELD_CLASSES} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="endDate" className="text-meta font-ui text-ink-soft">
            To
          </label>
          <input id="endDate" name="endDate" type="date" defaultValue={endDate ?? ""} className={FIELD_CLASSES} />
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {hasFilters ? (
          <a href="/admin/audit-log" className="text-meta font-ui text-action underline">
            Clear filters
          </a>
        ) : null}
      </form>

      {entries.length === 0 ? (
        <div className="mt-6">
          <EmptyState headline="No matching entries" body="Nothing in the audit log matches these filters." />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card>
                <p className="text-body font-ui font-medium text-ink">{entry.actionLabel}</p>
                <p className="text-meta font-ui text-ink-soft">
                  {entry.actorEmail ?? "Unknown actor"} · {entry.subjectType.replace(/_/g, " ")} {entry.subjectId} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
                {entry.reason ? <p className="text-meta font-ui text-ink-soft">Reason: {entry.reason}</p> : null}
                {attendanceChanges(entry.metadata).length > 0 ? (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {attendanceChanges(entry.metadata).map((change, index) => (
                      <p key={index} className="text-meta font-ui text-ink-soft">
                        {change.applicant_id}: {change.previous_status ?? "unmarked"} → {change.new_status}
                      </p>
                    ))}
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
