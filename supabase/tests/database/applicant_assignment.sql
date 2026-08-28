-- Coverage for A2's schema/function additions: the cohorts stub, the
-- intake_complete -> pending_review auto-advance (the P2 gap this
-- session depends on), and the three atomic assign/decline/reopen
-- functions. Same methodology as every other suite here: real role
-- switches, never assumed; audit_log counts scoped by a baseline delta
-- (see CLAUDE.md's 2026-08-28 Learned Constraints entry - an absolute
-- count broke once before on the "brand new enum value" assumption).

begin;
select plan(23);

insert into auth.users (id, email) values
  ('44444444-0000-0000-0000-000000000001', 'a2-admin@example.com'),
  ('44444444-0000-0000-0000-000000000002', 'a2-member@example.com');
update profiles set role = 'admin' where id = '44444444-0000-0000-0000-000000000001';

insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-00000000a2a2', 'A2 Test Org', 'pgtap-a2-org');

-- cohorts RLS: admin-only for now (see the migration's own comment on
-- why facilitator/partner_staff scoping isn't built yet).
insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone)
values (
  '55555555-0000-0000-0000-000000000001', 'pgTAP Test Cohort', 'Spouses, early stage',
  1, 'Weekly', 2, '18:30', 'America/New_York'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-0000-0000-0000-000000000001", "role": "authenticated"}';
select is(
  (select name from cohorts where id = '55555555-0000-0000-0000-000000000001'),
  'pgTAP Test Cohort',
  'admin can read cohorts'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  (select count(*)::int from cohorts where id = '55555555-0000-0000-0000-000000000001'),
  0,
  'a non-admin member cannot read cohorts'
);
reset role;

set local role anon;
select throws_ok(
  $$ insert into cohorts (name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone)
     values ('Fake', 'x', 1, 'Weekly', 0, '10:00', 'UTC') $$,
  '42501', null,
  'anon cannot create a cohort'
);
reset role;

-- intake_complete -> pending_review auto-advance
insert into applicants (id, partner_organization_id, referral_source, status)
values ('33333333-0000-0000-0000-00000000a201', '11111111-0000-0000-0000-00000000a2a2', 'partner_link', 'referred');

update applicants set status = 'intake_complete' where id = '33333333-0000-0000-0000-00000000a201';

select is(
  (select status::text from applicants where id = '33333333-0000-0000-0000-00000000a201'),
  'pending_review',
  'an applicant set to intake_complete automatically advances to pending_review'
);

select is(
  (select pending_review_since is not null from applicants where id = '33333333-0000-0000-0000-00000000a201'),
  true,
  'pending_review_since is stamped by the auto-advance'
);

select is(
  -- ordered by id (real insertion order), not created_at - every
  -- statement in this file shares one transaction, so now() (created_at's
  -- default) is identical across all of them and ties break arbitrarily.
  (select array_agg(to_status::text order by id)
     from applicant_status_events where applicant_id = '33333333-0000-0000-0000-00000000a201'),
  array['referred', 'intake_complete', 'pending_review'],
  'both transitions are logged separately, in order - intake_complete is not skipped from history'
);

-- assign_applicant_to_cohort
set local role authenticated;
select throws_ok(
  $$ select assign_applicant_to_cohort(
       '44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-00000000a201',
       '55555555-0000-0000-0000-000000000001') $$,
  '42501', null,
  'authenticated cannot call assign_applicant_to_cohort directly - execute not granted'
);
reset role;

set local role service_role;

-- Created under service_role (not the default connecting role) so the
-- later baseline-delta reads below, which also run as service_role, can
-- actually see it - a temp table's default privileges belong to whoever
-- created it (same fix as A1 PR3's own suite needed).
create temporary table audit_log_baseline as
  select
    count(*) filter (where action = 'applicant_assigned')::int as assigned_n,
    count(*) filter (where action = 'applicant_declined')::int as declined_n,
    count(*) filter (where action = 'applicant_reopened')::int as reopened_n
  from audit_log
  where subject_type = 'applicant';

select lives_ok(
  $$ select assign_applicant_to_cohort(
       '44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-00000000a201',
       '55555555-0000-0000-0000-000000000001') $$,
  'service_role can assign a pending_review applicant to a cohort with room'
);

select is(
  (select status::text from applicants where id = '33333333-0000-0000-0000-00000000a201'),
  'enrolled',
  'assignment moves the applicant to enrolled'
);

select is(
  (select cohort_id from applicants where id = '33333333-0000-0000-0000-00000000a201'),
  '55555555-0000-0000-0000-000000000001'::uuid,
  'assignment records which cohort'
);

select is(
  (select count(*)::int from audit_log where action = 'applicant_assigned' and subject_type = 'applicant')
    - (select assigned_n from audit_log_baseline),
  1,
  'assignment writes exactly one new matching audit_log row'
);

-- capacity enforcement: the cohort above has capacity 1 and is now full
insert into applicants (id, partner_organization_id, referral_source, status)
values ('33333333-0000-0000-0000-00000000a202', '11111111-0000-0000-0000-00000000a2a2', 'staff_form', 'pending_review');

select throws_ok(
  $$ select assign_applicant_to_cohort(
       '44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-00000000a202',
       '55555555-0000-0000-0000-000000000001') $$,
  null, 'cohort 55555555-0000-0000-0000-000000000001 is at capacity',
  'assigning into a full cohort raises rather than silently over-filling it'
);

-- wrong-status guard: the applicant assigned above is now 'enrolled', not pending_review
select throws_ok(
  $$ select assign_applicant_to_cohort(
       '44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-00000000a201',
       '55555555-0000-0000-0000-000000000001') $$,
  null, 'applicant 33333333-0000-0000-0000-00000000a201 is not awaiting review',
  'assigning an applicant who is not pending_review raises'
);

-- decline_applicant
select lives_ok(
  $$ select decline_applicant(
       '44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-00000000a202', 'not_a_fit') $$,
  'service_role can decline a pending_review applicant'
);

select is(
  (select status::text from applicants where id = '33333333-0000-0000-0000-00000000a202'),
  'declined',
  'decline records the status'
);
select is(
  (select decline_reason::text from applicants where id = '33333333-0000-0000-0000-00000000a202'),
  'not_a_fit',
  'decline records the reason code'
);

select is(
  (select count(*)::int from audit_log where action = 'applicant_declined' and subject_type = 'applicant')
    - (select declined_n from audit_log_baseline),
  1,
  'decline writes exactly one new matching audit_log row'
);

-- reopen_applicant
select lives_ok(
  $$ select reopen_applicant('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-00000000a202') $$,
  'service_role can reopen a declined applicant'
);

select is(
  (select status::text from applicants where id = '33333333-0000-0000-0000-00000000a202'),
  'pending_review',
  'reopen returns the applicant to pending_review'
);
select is(
  (select decline_reason from applicants where id = '33333333-0000-0000-0000-00000000a202'),
  null,
  'reopen clears the decline reason'
);

select is(
  (select count(*)::int from audit_log where action = 'applicant_reopened' and subject_type = 'applicant')
    - (select reopened_n from audit_log_baseline),
  1,
  'reopen writes exactly one new matching audit_log row'
);

-- Named-edge-case-style atomicity check, same shape as A1 PR3's own:
-- force the audit write to fail (an actor with no matching profiles row)
-- and confirm the applicant mutation rolls back with it.
select throws_ok(
  $$ select decline_applicant(
       '00000000-0000-0000-0000-000000000000', '33333333-0000-0000-0000-00000000a202', 'other') $$,
  '23503',
  null,
  'when the audit write fails (no matching actor profile), the decline rolls back with it'
);

select is(
  (select status::text from applicants where id = '33333333-0000-0000-0000-00000000a202'),
  'pending_review',
  'the rolled-back decline left the applicant exactly as reopen left it'
);

reset role;

select * from finish();
rollback;

-- Negative-test drill, run by hand per the run doc's methodology:
--   commented out the cohorts_select_admin_only policy in
--   20260829120000_cohorts_and_applicant_assignment_schema.sql
--   -> supabase db reset --local, re-ran this file: test 1 ("admin can
--      read cohorts") failed with "have: NULL, want: pgTAP Test Cohort" -
--      confirming the policy is what makes the read possible, not the
--      grant alone.
--   restored the policy, supabase db reset --local
--   -> re-ran this file: all 23 assertions passed again.
