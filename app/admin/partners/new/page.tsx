import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { createPartnerOrganizationAction } from "@/lib/admin/partner-organizations";
import { PartnerOrganizationForm } from "@/components/admin/partner-organization-form";

// Admin-only, narrower than app/admin/layout.tsx's allowed set - uses
// requireRoleOrRefuse rather than requireRole so a facilitator or
// partner_staff caller hitting this URL directly gets the refusal UI,
// not an unhandled error (see that helper's comment for why the
// layout's own try/catch can't cover a throw from a child page).
export default async function NewPartnerOrganizationPage() {
  const result = await requireRoleOrRefuse(["admin"]);
  if ("refusal" in result) return result.refusal;

  return (
    <div className="max-w-xl">
      <h1 className="text-h1 font-heading text-ink">New partner organization</h1>
      <div className="mt-6">
        <PartnerOrganizationForm action={createPartnerOrganizationAction} submitLabel="Create organization" />
      </div>
    </div>
  );
}
