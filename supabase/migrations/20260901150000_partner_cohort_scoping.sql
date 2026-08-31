-- A5 (Wave 7): partner_staff read-scoping for cohorts and sessions - "a
-- partner organization sees cohorts containing caregivers they referred."
-- Deferred explicitly by A2's own migration comment ("A3/A5 build the
-- read-scoping once cohorts have facilitators and real membership") and
-- by lib/admin/cohorts.ts's own comment ("A5's job, Wave 7").
--
-- No new column needed: the same shape P2 already built for applicants
-- (profiles.partner_organization_id = applicants.partner_organization_id)
-- extends naturally via applicants.cohort_id, which A2 already added.
-- Additive alongside the existing admin/facilitator policies - Postgres
-- combines multiple permissive SELECT policies with OR, so this only
-- ever widens access for partner_staff, never narrows admin's or a
-- facilitator's.

create policy "cohorts_select_own_partner_referrals"
  on cohorts for select
  to authenticated
  using (
    exists (
      select 1 from applicants
      where applicants.cohort_id = cohorts.id
        and applicants.partner_organization_id = (
          select partner_organization_id from profiles where id = auth.uid()
        )
    )
  );

-- Same shape for sessions, one join further out: a partner_staff caller
-- sees a session only when its cohort has at least one of their referred
-- applicants enrolled in it.
create policy "sessions_select_own_partner_referrals"
  on sessions for select
  to authenticated
  using (
    exists (
      select 1 from applicants
      where applicants.cohort_id = sessions.cohort_id
        and applicants.partner_organization_id = (
          select partner_organization_id from profiles where id = auth.uid()
        )
    )
  );
