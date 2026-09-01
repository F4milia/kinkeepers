import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { listFailedNotifications } from "@/lib/admin/notifications";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

// Admin-only - the failed-send queue named in P4's acceptance criteria
// ("failed sends surface in an admin view"). Same requireRoleOrRefuse
// pattern as app/admin/reports/page.tsx and app/admin/data-requests/page.tsx.
export default async function AdminNotificationsPage() {
  const result = await requireRoleOrRefuse(["admin"]);
  if ("refusal" in result) return result.refusal;

  const failures = await listFailedNotifications();

  return (
    <div className="max-w-3xl">
      <h1 className="text-h1 font-heading text-ink">Notifications</h1>
      <p className="mt-2 text-body font-ui text-ink-soft">Message sends that failed and never reached a member.</p>

      {failures.length === 0 ? (
        <div className="mt-6">
          <EmptyState headline="No failed sends" body="Every notification attempt so far has gone through." />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {failures.map((failure) => (
            <li key={failure.id}>
              <Card>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-body font-ui font-medium text-ink">
                      {failure.notificationType} · {failure.applicantEmail ?? failure.applicantPhone ?? "Unknown member"}
                    </p>
                    <p className="text-meta font-ui text-ink-soft">
                      {new Date(failure.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="gentle">{failure.channel} failed</Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
