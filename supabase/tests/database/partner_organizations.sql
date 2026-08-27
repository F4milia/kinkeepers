-- Coverage for the partner_organizations migration (P2, built early -
-- see that migration's header for why this landed before A1).
--
-- Per the run doc's methodology: every isolation boundary is tested as a
-- real authenticated/anon role, never assumed. Uses a slug distinct from
-- seed.sql's ('pgtap-test-org') and counts scoped to that one row, not an
-- absolute table count - seed.sql now seeds real partner orgs, and an
-- absolute count would break the moment it does (same class of bug as
-- the audit_log absolute-count fix).

begin;
select plan(6);

insert into partner_organizations (name, referral_link_slug) values
  ('pgTAP Test Org', 'pgtap-test-org');

-- Public, unauthenticated read - this is what resolves "Referred by
-- [name]" on the referral landing page before intake or sign-in starts.
set local role anon;
select is(
  (select name from partner_organizations where referral_link_slug = 'pgtap-test-org'),
  'pgTAP Test Org',
  'anon can read a partner organization by its referral slug'
);

select throws_ok(
  $$ insert into partner_organizations (name, referral_link_slug) values ('Fake Org', 'pgtap-fake-org') $$,
  '42501',
  null,
  'anon cannot create a partner organization'
);
reset role;

set local role authenticated;
select is(
  (select count(*)::int from partner_organizations where referral_link_slug = 'pgtap-test-org'),
  1,
  'authenticated can also read partner organizations'
);

select throws_ok(
  $$ update partner_organizations set name = 'Renamed' where referral_link_slug = 'pgtap-test-org' $$,
  '42501',
  null,
  'authenticated cannot update a partner organization'
);
reset role;

-- service_role: full access, as the eventual admin CRUD backend (A1).
set local role service_role;
select lives_ok(
  $$ update partner_organizations set name = 'pgTAP Test Org (renamed)' where referral_link_slug = 'pgtap-test-org' $$,
  'service_role can update a partner organization'
);
select lives_ok(
  $$ delete from partner_organizations where referral_link_slug = 'pgtap-test-org' $$,
  'service_role can delete a partner organization'
);
reset role;

select * from finish();
rollback;

-- Negative-test drill, run by hand per the run doc's methodology:
--   drop policy partner_organizations_select_all on partner_organizations;
--   -> re-ran this file: both read assertions failed (test 1, anon:
--      "have: NULL, want: pgTAP Test Org"; test 3, authenticated:
--      "have: 0, want: 1") - confirming the policy is what makes the
--      read possible for both roles, not the grant alone.
--   supabase db reset (restores the migration, including the policy)
--   -> re-ran this file: all 6 assertions passed again.
