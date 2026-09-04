import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { listLicensedPrograms, listFacilitators } from "@/lib/admin/cohorts";
import { listPartnerOrganizations } from "@/lib/admin/partner-organizations";
import { CohortCreationForm } from "@/components/admin/cohort-creation-form";

// Admin-only, narrower than app/admin/layout.tsx's allowed set - see
// app/admin/partners/new/page.tsx's comment for why this needs its own
// requireRoleOrRefuse rather than relying on the layout alone.
export default async function NewCohortPage() {
  const result = await requireRoleOrRefuse(["admin"]);
  if ("refusal" in result) return result.refusal;

  const [programs, facilitators, partnerOrganizations] = await Promise.all([
    listLicensedPrograms(),
    listFacilitators(),
    listPartnerOrganizations(),
  ]);

  // A3's own field list ("partner organization (optional)") had no UI at
  // all - createCohortAction/resolveZoomCredentialsForPartner already
  // fully supported and tested it, but nothing ever let an admin pick
  // one. Found during a 2026-09-04 acceptance-criteria audit. Only
  // active orgs are offered, same reasoning as licensed-only programs -
  // an inactive/terminated partner shouldn't be newly assignable.
  const activePartnerOrganizations = partnerOrganizations.filter((org) => org.status === "active");

  return (
    <div className="max-w-xl">
      <h1 className="text-h1 font-heading text-ink">New cohort</h1>
      <div className="mt-6">
        <CohortCreationForm
          programs={programs}
          facilitators={facilitators}
          partnerOrganizations={activePartnerOrganizations}
        />
      </div>
    </div>
  );
}
