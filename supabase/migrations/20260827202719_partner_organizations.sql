-- Minimal partner_organizations foundation, built early by P2 (Wave 1)
-- rather than A1 (Wave 2) as originally sequenced in the run doc: P2's
-- referral links are specified as "scoped per partner organization," so
-- the table has to exist before P2 can build that. This migration is
-- intentionally minimal (id, name, referral_link_slug) - A1 extends it
-- with status, contract_start, contract_end, notes, and the actual admin
-- CRUD UI. Same pattern as P1's minimal profiles table that later
-- sessions built on top of.

create table partner_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Embedded directly in a public referral URL path (e.g. /refer/{slug}),
  -- so constrained to what's safe there without escaping.
  referral_link_slug text not null unique check (referral_link_slug ~ '^[a-z0-9-]+$'),
  created_at timestamptz not null default now()
);

alter table partner_organizations enable row level security;

-- Default ACLs grant FULL privileges to anon/authenticated/service_role
-- automatically at creation time (see CLAUDE.md's Learned constraints,
-- 2026-08-26 entry) - explicit revoke first, then grant exactly what's
-- needed, same pattern as every migration since that was found.
revoke all on partner_organizations from anon, authenticated;
grant select on partner_organizations to anon, authenticated;
grant all on partner_organizations to service_role;

-- Referral link slugs are meant to be shared publicly - a partner hands
-- them to caregivers via email or a printed clinic card - so name+slug
-- are readable by anyone, signed in or not. This is what resolves
-- "Referred by [name]" on the public referral landing page, before
-- intake (or any sign-in) even starts. Writes are service-role-only for
-- now (no policy for anon/authenticated - default deny at the grant
-- level, same as profiles' role column); A1 builds the actual admin
-- CRUD UI on top of this table.
create policy "partner_organizations_select_all"
  on partner_organizations for select
  to anon, authenticated
  using (true);
