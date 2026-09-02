-- A5: partner_staff read-scoping for session_attendance - the same gap
-- as cohorts_select_own_partner_referrals/sessions_select_own_partner_referrals
-- (20260901150000_partner_cohort_scoping.sql), just one table later.
-- session_attendance didn't exist when that migration was written (X4
-- built it afterward), so this is the missing third leg: a partner_staff
-- caller sees an attendance row only when the attended applicant is
-- their own organization's referral. Needed for A5's partner CSV export
-- ("Export attendance and delivery") to read real attendance data
-- through the caller's own RLS-respecting client, same pattern as
-- getPartnerReferralSummary already uses for applicants.
--
-- Additive alongside the existing admin/facilitator/member policies -
-- Postgres combines multiple permissive SELECT policies with OR, so this
-- only ever widens access for partner_staff, never narrows anyone else's.
create policy "session_attendance_select_own_partner_referrals"
  on session_attendance for select
  to authenticated
  using (
    exists (
      select 1 from applicants
      where applicants.id = session_attendance.applicant_id
        and applicants.partner_organization_id = (
          select partner_organization_id from profiles where id = auth.uid()
        )
    )
  );
