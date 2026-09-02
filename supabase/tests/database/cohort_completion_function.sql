-- Coverage for mark_cohort_completed (A3 PR5). Same methodology as every
-- other suite here: real role switches, never assumed; audit_log counts
-- scoped by a baseline delta.

begin;
select plan(12);

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-00000000d001', 'pgTAP Completion Program', 'Test Developer', 3, 90, array['video'], array['English'], 'Lay leader', 'licensed');

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-00000000d001', 'a3-completion-admin@example.com');
update profiles set role = 'admin' where id = '66666666-0000-0000-0000-00000000d001';

insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, status)
values
  ('77777777-0000-0000-0000-00000000d001', 'Active Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-00000000d001', 'active'),
  ('77777777-0000-0000-0000-00000000d002', 'Draft Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-00000000d001', 'draft');

-- X3: an enrolled member, an attending member, and a declined member on
-- the cohort that's about to be marked completed - proves the cascade
-- added in 20260903100000 moves the first two to 'completed' and
-- leaves the declined one alone (a declined applicant was never really
-- part of the cohort's delivery, so their status shouldn't be touched
-- by it finishing).
insert into partner_organizations (id, name, referral_link_slug) values
  ('44444444-0000-0000-0000-00000000d001', 'pgTAP Completion Org', 'pgtap-completion-org');

insert into applicants (id, partner_organization_id, referral_source, first_name, status, cohort_id) values
  ('88888888-0000-0000-0000-00000000d001', '44444444-0000-0000-0000-00000000d001', 'partner_link', 'Enrolled Member', 'enrolled', '77777777-0000-0000-0000-00000000d001'),
  ('88888888-0000-0000-0000-00000000d002', '44444444-0000-0000-0000-00000000d001', 'partner_link', 'Attending Member', 'attending', '77777777-0000-0000-0000-00000000d001'),
  ('88888888-0000-0000-0000-00000000d003', '44444444-0000-0000-0000-00000000d001', 'partner_link', 'Declined Member', 'declined', '77777777-0000-0000-0000-00000000d001');

set local role authenticated;
select throws_ok(
  format($$ select mark_cohort_completed(%L, '77777777-0000-0000-0000-00000000d001') $$, '66666666-0000-0000-0000-00000000d001'),
  '42501', null, 'authenticated cannot call mark_cohort_completed directly'
);
reset role;

set local role service_role;

create temporary table audit_log_baseline as
  select count(*) filter (where action = 'cohort_completed')::int as completed_n
  from audit_log where subject_type = 'cohort';

select throws_ok(
  format($$ select mark_cohort_completed(%L, '77777777-0000-0000-0000-00000000d002') $$, '66666666-0000-0000-0000-00000000d001'),
  null, 'cohort 77777777-0000-0000-0000-00000000d002 is not active - only an active cohort can be marked completed',
  'a draft cohort cannot be marked completed'
);

select lives_ok(
  format($$ select mark_cohort_completed(%L, '77777777-0000-0000-0000-00000000d001') $$, '66666666-0000-0000-0000-00000000d001'),
  'service_role can mark an active cohort completed'
);

select is(
  (select status::text from cohorts where id = '77777777-0000-0000-0000-00000000d001'),
  'completed',
  'the cohort''s status is updated to completed'
);

select is(
  (select status::text from applicants where id = '88888888-0000-0000-0000-00000000d001'),
  'completed',
  'X3: an enrolled member''s own status cascades to completed'
);
select is(
  (select status::text from applicants where id = '88888888-0000-0000-0000-00000000d002'),
  'completed',
  'X3: an attending member''s own status cascades to completed too'
);
select is(
  (select status::text from applicants where id = '88888888-0000-0000-0000-00000000d003'),
  'declined',
  'X3: a declined member''s status is untouched by the cohort completing'
);

select is(
  (select count(*)::int from audit_log where action = 'cohort_completed' and subject_type = 'cohort')
    - (select completed_n from audit_log_baseline),
  1,
  'marking completed writes exactly one new matching audit_log row'
);

select throws_ok(
  format($$ select mark_cohort_completed(%L, '77777777-0000-0000-0000-00000000d001') $$, '66666666-0000-0000-0000-00000000d001'),
  null, 'cohort 77777777-0000-0000-0000-00000000d001 is not active - only an active cohort can be marked completed',
  'an already-completed cohort cannot be marked completed again'
);

select throws_ok(
  format($$ select mark_cohort_completed(%L, '00000000-0000-0000-0000-000000000000') $$, '66666666-0000-0000-0000-00000000d001'),
  null, 'cohort 00000000-0000-0000-0000-000000000000 is not active - only an active cohort can be marked completed',
  'marking a nonexistent cohort completed raises the same not-found-shaped error'
);

-- Named-edge-case-style atomicity check: force the audit write to fail
-- (an actor with no matching profiles row) and confirm the cohort's
-- status rolls back with it.
insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, status)
values ('77777777-0000-0000-0000-00000000d003', 'Rollback Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-00000000d001', 'active');

select throws_ok(
  $$ select mark_cohort_completed('00000000-0000-0000-0000-000000000000', '77777777-0000-0000-0000-00000000d003') $$,
  '23503', null,
  'when the audit write fails (no matching actor profile), marking completed rolls back with it'
);

select is(
  (select status::text from cohorts where id = '77777777-0000-0000-0000-00000000d003'),
  'active',
  'the rolled-back cohort is still active, not completed'
);

reset role;

select * from finish();
rollback;
