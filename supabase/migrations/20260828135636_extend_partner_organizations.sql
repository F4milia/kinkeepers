-- Extends partner_organizations (P2's minimal version) with the rest of
-- A1's originally-specified columns: status, contract_start,
-- contract_end, notes. See P2 PR1's migration for why the table exists
-- already - P2's referral links needed it before A1 was scheduled to run.
--
-- `status` is a genuinely new value set with no exact wording given
-- anywhere in the docs (unlike, say, applicant_status, whose values are
-- named directly in the P2 prompt). This is an internal-admin-only
-- operational field though, not member-facing copy - the "no invented
-- copy" rule is scoped to member/facilitator screens, and /admin
-- carries its own density/treatment exemption throughout CLAUDE.md.
-- Two states (active/inactive) cover the operationally meaningful
-- distinction (currently referring/being billed, vs not) without
-- inventing a larger lifecycle taxonomy nobody asked for.
create type partner_organization_status as enum ('active', 'inactive');

alter table partner_organizations
  add column status partner_organization_status not null default 'active',
  add column contract_start date,
  add column contract_end date,
  add column notes text;
