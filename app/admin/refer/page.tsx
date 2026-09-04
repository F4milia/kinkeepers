import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { createStaffReferralAction } from "@/lib/referral/actions";
import { StaffReferralForm } from "@/components/admin/staff-referral-form";
import { COPY } from "@/lib/copy";

// P2's second referral path ("a staff-facing form where a navigator
// submits on the caregiver's behalf") - the Server Action
// (createStaffReferral) was built and tested in P2's own PR, but no
// screen ever called it. Found missing entirely during a 2026-09-04
// acceptance-criteria audit; this is that missing screen. partner_staff
// only, narrower than app/admin/layout.tsx's allowed set, matching
// createStaffReferral()'s own requireRole(["partner_staff"]) gate - an
// admin has no partner_organization_id to scope a referral to.
export default async function ReferPage() {
  const result = await requireRoleOrRefuse(["partner_staff"]);
  if ("refusal" in result) return result.refusal;

  return (
    <div className="max-w-xl">
      <h1 className="text-h1 font-heading text-ink">{COPY.referral.staff.title}</h1>
      <p className="mt-2 text-body font-ui text-ink-soft">{COPY.referral.staff.intro}</p>
      <div className="mt-6">
        <StaffReferralForm action={createStaffReferralAction} />
      </div>
    </div>
  );
}
