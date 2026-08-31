-- Coverage for mark_cohort_completed (A3 PR5). Same methodology as every
-- other suite here: real role switches, never assumed; audit_log counts
-- scoped by a baseline delta.

begin;
select plan(9);

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-00000000d001', 'pgTAP Completion Program', 'Test Developer', 3, 90, array['video'], array['English'], 'Lay leader', 'licensed');

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-00000000d001', 'a3-completion-admin@example.com');
update profiles set role = 'admin' where id = '66666666-0000-0000-0000-00000000d001';

insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, status)
values
  ('77777777-0000-0000-0000-00000000d001', 'Active Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-00000000d001', 'active'),
  ('77777777-0000-0000-0000-00000000d002', 'Draft Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-00000000d001', 'draft');

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
