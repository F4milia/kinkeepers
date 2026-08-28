-- Coverage for admin_create_partner_organization / admin_update_partner_organization
-- (A1 PR3) - the two security-definer functions that compose a
-- partner_organizations mutation with its audit_log row into one
-- transaction. Same methodology as every other suite here: real role
-- switches, never assumed; audit_log counts scoped by a baseline delta,
-- not an absolute value.
--
-- An absolute count of 1 was tried first on the theory that
-- 'partner_organization_created'/'partner_organization_updated' are
-- brand-new enum values nothing else could have written yet - true only
-- until lib/admin/partner-organizations.test.ts (a vitest suite that
-- calls these functions against the real, non-rolled-back local
-- database, same as any app-level integration test) ran once and left
-- real permanent rows behind. Same class of bug as audit_log.sql's own
-- header describes; same fix.

begin;
select plan(10);

insert into auth.users (id, email) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'partner-org-admin@example.com');
update profiles set role = 'admin' where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

-- EXECUTE is service_role-only - these functions trust their actor_id
-- argument rather than checking the caller's own role, so nothing else
-- may call them at all.
set local role authenticated;
select throws_ok(
  $$ select admin_create_partner_organization(
       'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Blocked Org', 'blocked-org',
       'active', null, null, null) $$,
  '42501', null,
  'authenticated cannot call admin_create_partner_organization directly - execute not granted'
);
reset role;

set local role service_role;

-- Created under service_role (not the default connecting role) so the
-- later baseline-delta reads below, which also run as service_role, can
-- actually see it - a temp table's default privileges belong to whoever
-- created it.
create temporary table audit_log_baseline as
  select
    count(*) filter (where action = 'partner_organization_created')::int as created_n,
    count(*) filter (where action = 'partner_organization_updated')::int as updated_n
  from audit_log
  where subject_type = 'partner_organization';

select lives_ok(
  $$ select admin_create_partner_organization(
       'dddddddd-dddd-dddd-dddd-dddddddddddd', 'pgTAP CRUD Org', 'pgtap-crud-org',
       'active', '2026-01-01'::date, null, 'created via pgTAP') $$,
  'service_role can create a partner organization via the admin function'
);

select is(
  (select status::text from partner_organizations where referral_link_slug = 'pgtap-crud-org'),
  'active',
  'the created row has the expected status'
);

select is(
  (select count(*)::int from audit_log
     where action = 'partner_organization_created' and subject_type = 'partner_organization')
    - (select created_n from audit_log_baseline),
  1,
  'creating a partner organization writes exactly one new matching audit_log row'
);

select lives_ok(
  $$ select admin_update_partner_organization(
       'dddddddd-dddd-dddd-dddd-dddddddddddd',
       (select id from partner_organizations where referral_link_slug = 'pgtap-crud-org'),
       'pgTAP CRUD Org (renamed)', 'pgtap-crud-org', 'inactive',
       '2026-01-01'::date, '2026-06-01'::date, 'updated via pgTAP') $$,
  'service_role can update a partner organization via the admin function'
);

select is(
  (select status::text from partner_organizations where referral_link_slug = 'pgtap-crud-org'),
  'inactive',
  'the updated row reflects the new status'
);

select is(
  (select count(*)::int from audit_log
     where action = 'partner_organization_updated' and subject_type = 'partner_organization')
    - (select updated_n from audit_log_baseline),
  1,
  'updating a partner organization writes exactly one new matching audit_log row'
);

select throws_ok(
  $$ select admin_update_partner_organization(
       'dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000',
       'Ghost', 'ghost-org', 'active', null, null, null) $$,
  'P0001', null,
  'updating a nonexistent partner organization raises rather than silently no-oping'
);

-- Named edge case, same shape as audit_log.sql's own worked example:
-- force the audit write to fail (an actor_id with no matching profiles
-- row - record_audit_event's actor_id has a foreign key to profiles) and
-- confirm the co-occurring mutation rolls back with it, per CLAUDE.md
-- invariant #9 ("if the audit write fails, the mutation fails").
select throws_ok(
  $$ select admin_create_partner_organization(
       '00000000-0000-0000-0000-000000000000', 'Should Not Exist', 'should-not-exist',
       'active', null, null, null) $$,
  '23503',
  null,
  'when the audit write fails (no matching actor profile), the create rolls back with it'
);

select is(
  (select count(*)::int from partner_organizations where referral_link_slug = 'should-not-exist'),
  0,
  'the rolled-back create left no partner_organizations row behind'
);

reset role;

select * from finish();
rollback;
