-- Coverage for the referral/intake/status/waitlist migration (P2).
--
-- Per the run doc's methodology: every isolation boundary is tested as a
-- real authenticated role, never assumed.

begin;
select plan(11);

-- Two partner orgs and two partner-staff users, one per org, plus an
-- admin - enough to prove cross-org isolation, not just same-org access.
insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-000000000001', 'Org A', 'pgtap-org-a'),
  ('11111111-0000-0000-0000-000000000002', 'Org B', 'pgtap-org-b');

insert into auth.users (id, email) values
  ('22222222-0000-0000-0000-000000000001', 'staff-a@example.com'),
  ('22222222-0000-0000-0000-000000000002', 'staff-b@example.com'),
  ('22222222-0000-0000-0000-000000000003', 'admin@example.com');

update profiles set role = 'partner_staff', partner_organization_id = '11111111-0000-0000-0000-000000000001'
  where id = '22222222-0000-0000-0000-000000000001';
update profiles set role = 'partner_staff', partner_organization_id = '11111111-0000-0000-0000-000000000002'
  where id = '22222222-0000-0000-0000-000000000002';
update profiles set role = 'admin'
  where id = '22222222-0000-0000-0000-000000000003';

-- One applicant per org, created as service_role (matching how the real
-- referral Server Actions will write - see the migration's own comment
-- on why anon/authenticated get no direct insert grant).
insert into applicants (id, partner_organization_id, referral_source, first_name, relationship, care_recipient_stage)
values (
  '33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
  'partner_link', 'Applicant A', 'spouse', 'early'
);
insert into applicants (id, partner_organization_id, referral_source, first_name, relationship, care_recipient_stage)
values (
  '33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002',
  'staff_form', 'Applicant B', 'adult_child', 'middle'
);

-- Trigger: the initial insert logs a null -> 'referred' event automatically.
select is(
  (select to_status::text from applicant_status_events
     where applicant_id = '33333333-0000-0000-0000-000000000001'),
  'referred',
  'inserting an applicant auto-logs a null -> referred status event'
);
select is(
  (select from_status from applicant_status_events
     where applicant_id = '33333333-0000-0000-0000-000000000001'),
  null,
  'the initial status event has a null from_status'
);

-- P4-pre's own spec: "Channel: email, SMS, or both. Default both." -
-- neither applicant insert above sets preferred_contact_channel, so this
-- proves the column's own default actually applies (20260905140000),
-- not just that some caller happens to pass 'both' explicitly.
select is(
  (select preferred_contact_channel::text from applicants
     where id = '33333333-0000-0000-0000-000000000001'),
  'both',
  'an applicant row with no explicit preference defaults to both channels'
);

-- Trigger: an UPDATE that changes status logs a second event.
update applicants set status = 'pending_review' where id = '33333333-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from applicant_status_events where applicant_id = '33333333-0000-0000-0000-000000000001'),
  2,
  'a status change logs a second event (referred -> pending_review)'
);

-- Partner staff: can read their own org's applicant...
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-0000-0000-0000-000000000001", "role": "authenticated"}';
select is(
  (select first_name from applicants where id = '33333333-0000-0000-0000-000000000001'),
  'Applicant A',
  'partner staff can read their own organization''s applicant'
);
-- ...but not the other org's.
select is(
  (select count(*)::int from applicants where id = '33333333-0000-0000-0000-000000000002'),
  0,
  'partner staff cannot read a different organization''s applicant'
);
select throws_ok(
  $$ insert into applicants (partner_organization_id, referral_source)
     values ('11111111-0000-0000-0000-000000000001', 'staff_form') $$,
  '42501',
  null,
  'partner staff cannot insert an applicant directly (no grant - writes go through Server Actions)'
);

-- Admin: sees both of THIS test's applicants - scoped to their ids, not
-- a raw table count. applicants is never actually empty in a long-lived
-- database (every applicant_status_events-holding row is permanently
-- undeletable - see lib/referral/actions.test.ts's afterAll for why),
-- so an absolute count here would be the same class of bug already
-- fixed once in audit_log.sql's pgTAP test - fixed here the same way
-- before it ever shipped broken (caught while building P2 PR4).
set local request.jwt.claims to '{"sub": "22222222-0000-0000-0000-000000000003", "role": "authenticated"}';
select is(
  (select count(*)::int from applicants
     where id in ('33333333-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002')),
  2,
  'admin can read applicants across every partner organization'
);

-- applicant_status_events: default-deny for authenticated, same as
-- audit_log and sign_in_events - reading the history is server-side only.
select throws_ok(
  $$ select count(*) from applicant_status_events $$,
  '42501',
  null,
  'authenticated cannot query applicant_status_events at all'
);
reset role;

-- Append-only: even service_role cannot edit or delete a status event.
set local role service_role;
select throws_ok(
  $$ update applicant_status_events set reason = 'edited' where applicant_id = '33333333-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'service_role cannot UPDATE applicant_status_events'
);
reset role;

-- Waitlist view: Org A's applicant is in pending_review (spouse/early);
-- Org B's is still 'referred', not yet in the waitlist. Query as Org A's
-- staff - security_invoker means the view respects THEIR RLS, so it
-- only reflects what they could see querying applicants directly.
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-0000-0000-0000-000000000001", "role": "authenticated"}';
select is(
  (select waiting_count::int from applicant_waitlist_summary
     where relationship = 'spouse' and care_recipient_stage = 'early'),
  1,
  'waitlist summary groups by relationship+stage and counts correctly, scoped by the caller''s own RLS'
);
reset role;

select * from finish();
rollback;

-- Negative-test drill, run by hand per the run doc's methodology:
--   drop policy applicants_select_own_partner_org_or_admin on applicants;
--   -> re-ran this file: 3 of 10 failed (test 4, partner staff own-org
--      read: "have: NULL, want: Applicant A"; test 7, admin read-all:
--      "have: 0, want: 2"; test 10, waitlist view: "have: NULL, want:
--      1") - confirming the policy is what makes both the direct
--      applicants reads AND the waitlist view (which relies on the
--      same RLS via security_invoker) work, not the grant alone.
--   supabase db reset (restores the migration, including the policy)
--   -> re-ran this file: all 10 assertions passed again.
