import Link from "next/link";
import { listPartnerOrganizations } from "@/lib/admin/partner-organizations";
import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

// Admin-only, narrower than app/admin/layout.tsx's allowed set - see
// app/admin/partners/new/page.tsx's comment for why this needs its own
// requireRoleOrRefuse rather than relying on the layout alone.
export default async function AdminPartnersPage() {
  const result = await requireRoleOrRefuse(["admin"]);
  if ("refusal" in result) return result.refusal;

  const organizations = await listPartnerOrganizations();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-h1 font-heading text-ink">Partner organizations</h1>
        <Link href="/admin/partners/new" className={buttonClasses("primary")}>
          New organization
        </Link>
      </div>

      {organizations.length === 0 ? (
        <EmptyState
          headline="No partner organizations yet"
          body="Add one to generate a referral link caregivers or care navigators can use."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {organizations.map((org) => (
            <li key={org.id}>
              <Card interactive href={`/admin/partners/${org.id}/edit`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-body font-ui font-medium text-ink">{org.name}</p>
                    <p className="text-meta font-ui text-ink-soft">/{org.referral_link_slug}</p>
                  </div>
                  <Badge variant={org.status === "active" ? "accent" : "neutral"}>
                    {org.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
