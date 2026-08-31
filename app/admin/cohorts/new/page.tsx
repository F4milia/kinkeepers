import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { listLicensedPrograms, listFacilitators } from "@/lib/admin/cohorts";
import { CohortCreationForm } from "@/components/admin/cohort-creation-form";

// Admin-only, narrower than app/admin/layout.tsx's allowed set - see
// app/admin/partners/new/page.tsx's comment for why this needs its own
// requireRoleOrRefuse rather than relying on the layout alone.
export default async function NewCohortPage() {
  const result = await requireRoleOrRefuse(["admin"]);
  if ("refusal" in result) return result.refusal;

  const [programs, facilitators] = await Promise.all([listLicensedPrograms(), listFacilitators()]);

  return (
    <div className="max-w-xl">
      <h1 className="text-h1 font-heading text-ink">New cohort</h1>
      <div className="mt-6">
        <CohortCreationForm programs={programs} facilitators={facilitators} />
      </div>
    </div>
  );
}
