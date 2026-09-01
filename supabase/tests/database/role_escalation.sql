-- X5a: role/scope escalation boundary.
--
-- profiles is granted SELECT only to authenticated (see the P1 migration)
-- - no UPDATE grant exists at all, so an update attempt fails at the grant
-- level (42501) before RLS even evaluates it. That's been true since P1's
-- migration, but never verified as a permanent, CI-run test before this -
-- only checked by hand, once, during P7a (see that session's notes,
-- and the correction below - the actual failure mode is a grant-level
-- permission error, not a silently-filtered zero-row update as originally
-- assumed). This file makes it a standing boundary.
--
-- Per the run doc's methodology: every isolation boundary is tested as a
-- real authenticated user, never the service role.
--
-- Cohort isolation (the third X5a boundary, originally deferred here
-- because no cohorts/posts schema existed yet) is closed as of X5b - not
-- in this file, but as an incidental consequence of two other sessions'
-- own work: cohort_creation_schema.sql (A3) proves one facilitator cannot
-- read another facilitator's cohort, and member_identity_bridge.sql (L5)
-- proves a member cannot read a cohort they aren't enrolled in - its
-- rows, sessions, or roster - complete with a real negative-test drill.
-- Both were built for reasons unrelated to X5b and happened to close the
-- gap this comment used to flag; X5b's own job ended up being this
-- correction, not new isolation logic. No `posts`/discussion schema
-- exists yet, so that half of the original note is still accurate and
-- still open for whichever session builds it.
-- Organization isolation (the first X5a boundary) is not repeated here -
-- already thoroughly covered by P2's referral_intake_schema.sql.

begin;
select plan(4);

-- A member, and a partner-staff user scoped to Org A - reusing the same
-- two-org setup pattern as referral_intake_schema.sql so this file proves
-- something referral_intake_schema.sql doesn't: escalation via profiles
-- itself, not just direct queries against applicants.
insert into partner_organizations (id, name, referral_link_slug) values
  ('44444444-0000-0000-0000-000000000001', 'Org A (role-escalation test)', 'pgtap-esc-org-a'),
  ('44444444-0000-0000-0000-000000000002', 'Org B (role-escalation test)', 'pgtap-esc-org-b');

insert into auth.users (id, email) values
  ('55555555-0000-0000-0000-000000000001', 'member-esc@example.com'),
  ('55555555-0000-0000-0000-000000000002', 'staff-esc-a@example.com');

update profiles set role = 'partner_staff', partner_organization_id = '44444444-0000-0000-0000-000000000001'
  where id = '55555555-0000-0000-0000-000000000002';

-- Org B has an applicant that Org A's staff should never be able to read -
-- this is the concrete consequence if the partner_organization_id
-- escalation below ever succeeded.
insert into applicants (id, partner_organization_id, referral_source, first_name, relationship, care_recipient_stage)
values (
  '66666666-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002',
  'partner_link', 'Org B Applicant', 'spouse', 'early'
);

-- A plain member cannot self-promote to admin.
set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-0000-0000-0000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$ update profiles set role = 'admin' where id = '55555555-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'a member cannot update their own role - no UPDATE grant on profiles at all, not just no policy'
);
reset role;

-- Partner staff cannot re-scope themselves onto a different organization
-- to read that organization's applicants - same grant-level block.
set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-0000-0000-0000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$ update profiles set partner_organization_id = '44444444-0000-0000-0000-000000000002'
       where id = '55555555-0000-0000-0000-000000000002' $$,
  '42501',
  null,
  'partner staff cannot update their own partner_organization_id - same grant-level block'
);

-- The concrete consequence, proven directly: still cannot read Org B's
-- applicant, because the escalation attempt above did nothing.
select is(
  (select count(*)::int from applicants where id = '66666666-0000-0000-0000-000000000001'),
  0,
  'the blocked escalation has a real consequence: Org B''s applicant stays unreadable'
);
reset role;

-- service_role (system-side role changes - e.g. A1's future admin UI)
-- still works, same as every other table's append/admin-only pattern.
set local role service_role;
select lives_ok(
  $$ update profiles set role = 'admin' where id = '55555555-0000-0000-0000-000000000001' $$,
  'service_role can still update a profile''s role - escalation is blocked for authenticated, not for the system'
);
reset role;

select * from finish();
rollback;

-- Negative-test drill, actually run (not hypothetical) per the run doc's
-- methodology:
--   grant update on public.profiles to authenticated;
--   -> re-ran this file: tests 1 and 2 failed as expected ("caught: no
--      exception, wanted: 42501") - the grant-level block is real and
--      load-bearing. But tests 3 and 4 still PASSED - the actual data
--      never changed, because RLS's policy-level default-deny (no UPDATE
--      policy exists) silently zero-rows the update instead of raising.
--      This is a genuinely double-layered boundary: either the missing
--      grant OR the missing policy alone would be enough to block real
--      escalation, confirmed by removing only the grant layer and
--      watching the policy layer hold on its own.
--   revoke update on public.profiles from authenticated;
--   supabase db reset (restores full migration state)
--   -> re-ran this file: all 4 assertions passed again.
