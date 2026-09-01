import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { listDataRequests, listConsentGaps } from "@/lib/admin/data-requests";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MarkDataRequestFulfilledButton } from "@/components/admin/mark-data-request-fulfilled-button";

const STATUS_BADGE: Record<string, "neutral" | "accent"> = {
  pending: "accent",
  fulfilled: "neutral",
};

// Admin-only - narrower than the layout's allowed set, same pattern and
// same reason as app/admin/reports/page.tsx (facilitator/partner_staff
// have no reason to see member deletion/export request fulfillment).
export default async function AdminDataRequestsPage() {
  const result = await requireRoleOrRefuse(["admin"]);
  if ("refusal" in result) return result.refusal;

  const [requests, consentGaps] = await Promise.all([listDataRequests(), listConsentGaps()]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-h1 font-heading text-ink">Data requests</h1>
      <p className="mt-2 text-body font-ui text-ink-soft">
        Fulfillment is manual - mark a request fulfilled once the deletion or export has actually been done, with a
        note describing what was done.
      </p>

      {requests.length === 0 ? (
        <div className="mt-6">
          <EmptyState headline="No data requests" body="No member has requested a deletion or export yet." />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Card>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-body font-ui font-medium text-ink">
                      {request.requestType === "deletion" ? "Deletion request" : "Export request"} ·{" "}
                      {request.memberEmail ?? "Unknown member"}
                    </p>
                    <p className="text-meta font-ui text-ink-soft">
                      Requested {new Date(request.requestedAt).toLocaleDateString()}
                    </p>
                    {request.fulfillmentNote ? (
                      <p className="text-meta font-ui text-ink-soft">Note: {request.fulfillmentNote}</p>
                    ) : null}
                  </div>
                  <Badge variant={STATUS_BADGE[request.status] ?? "neutral"}>{request.status}</Badge>
                </div>
                {request.status === "pending" ? (
                  <div className="mt-3 border-t border-line pt-3">
                    <MarkDataRequestFulfilledButton requestId={request.id} />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-h3 font-heading text-ink">Consent gaps</h2>
      <p className="mt-2 text-body font-ui text-ink-soft">
        Members who haven&apos;t agreed to the current version of a required document.
      </p>

      {consentGaps.length === 0 ? (
        <div className="mt-6">
          <EmptyState headline="No consent gaps" body="Every member is current on every document." />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {consentGaps.map((gap) => (
            <li key={`${gap.memberId}-${gap.documentType}`}>
              <Card>
                <p className="text-body font-ui font-medium text-ink">{gap.memberEmail ?? "Unknown member"}</p>
                <p className="text-meta font-ui text-ink-soft">
                  {gap.documentType.replace(/_/g, " ")} (version {gap.currentVersion})
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
