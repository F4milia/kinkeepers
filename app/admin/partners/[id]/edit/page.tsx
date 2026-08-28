import { notFound } from "next/navigation";
import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { getPartnerOrganization, updatePartnerOrganizationAction } from "@/lib/admin/partner-organizations";
import { PartnerOrganizationForm } from "@/components/admin/partner-organization-form";

// Admin-only, narrower than app/admin/layout.tsx's allowed set - see
// app/admin/partners/new/page.tsx's comment for why this needs its own
// requireRoleOrRefuse rather than relying on the layout alone.
export default async function EditPartnerOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = await requireRoleOrRefuse(["admin"]);
  if ("refusal" in result) return result.refusal;

  const { id } = await params;
  const organization = await getPartnerOrganization(id);
  if (!organization) notFound();

  const action = updatePartnerOrganizationAction.bind(null, id);

  return (
    <div className="max-w-xl">
      <h1 className="text-h1 font-heading text-ink">Edit {organization.name}</h1>
      <div className="mt-6">
        <PartnerOrganizationForm action={action} initial={organization} submitLabel="Save changes" />
      </div>
    </div>
  );
}
