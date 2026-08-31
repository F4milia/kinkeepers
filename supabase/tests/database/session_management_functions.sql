-- Coverage for reschedule_session / cancel_session / record_session_substitute
-- (A3 PR4). Same methodology as every other suite here: real role
-- switches, never assumed; audit_log counts scoped by a baseline delta.

begin;
select plan(23);

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-00000000e001', 'pgTAP Session Mgmt Program', 'Test Developer', 3, 90, array['video'], array['English'], 'Lay leader', 'licensed');

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-00000000e001', 'a3-session-admin@example.com'),
  ('66666666-0000-0000-0000-00000000e002', 'a3-session-facilitator@example.com'),
  ('66666666-0000-0000-0000-00000000e003', 'a3-session-substitute@example.com');
update profiles set role = 'admin' where id = '66666666-0000-0000-0000-00000000e001';
update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-00000000e002';
update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-00000000e003';

insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, facilitator_id)
values ('77777777-0000-0000-0000-00000000e001', 'Session Mgmt Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-00000000e001', '66666666-0000-0000-0000-00000000e002');

insert into sessions (id, cohort_id, session_number, scheduled_at, video_occurrence_id)
values
  ('55555555-0000-0000-0000-00000000e001', '77777777-0000-0000-0000-00000000e001', 1, '2027-03-09 18:30:00+00', 'occ-e1'),
  ('55555555-0000-0000-0000-00000000e002', '77777777-0000-0000-0000-00000000e001', 2, '2027-03-16 18:30:00+00', 'occ-e2');

-- authenticated cannot call any of the three directly
set local role authenticated;
select throws_ok(
  format($$ select reschedule_session(%L, '55555555-0000-0000-0000-00000000e001', '2027-03-10 18:30:00+00'::timestamptz) $$, '66666666-0000-0000-0000-00000000e001'),
  '42501', null, 'authenticated cannot call reschedule_session directly'
);
select throws_ok(
  format($$ select cancel_session(%L, '55555555-0000-0000-0000-00000000e001', 'facilitator unavailable') $$, '66666666-0000-0000-0000-00000000e001'),
  '42501', null, 'authenticated cannot call cancel_session directly'
);
select throws_ok(
  format($$ select record_session_substitute(%L, '55555555-0000-0000-0000-00000000e001', '66666666-0000-0000-0000-00000000e003') $$, '66666666-0000-0000-0000-00000000e001'),
  '42501', null, 'authenticated cannot call record_session_substitute directly'
);
reset role;

set local role service_role;

create temporary table audit_log_baseline as
  select
    count(*) filter (where action = 'session_rescheduled')::int as rescheduled_n,
    count(*) filter (where action = 'session_cancelled')::int as cancelled_n,
    count(*) filter (where action = 'session_substitution_recorded')::int as substituted_n
  from audit_log
  where subject_type = 'session';

-- reschedule_session
select lives_ok(
  format($$ select reschedule_session(%L, '55555555-0000-0000-0000-00000000e001', '2027-03-10 19:00:00+00'::timestamptz) $$, '66666666-0000-0000-0000-00000000e001'),
  'service_role can reschedule a scheduled session'
);
select is(
  (select scheduled_at from sessions where id = '55555555-0000-0000-0000-00000000e001'),
  '2027-03-10 19:00:00+00'::timestamptz,
  'reschedule updates scheduled_at to the new instant'
);
select is(
  (select count(*)::int from audit_log where action = 'session_rescheduled' and subject_type = 'session')
    - (select rescheduled_n from audit_log_baseline),
  1,
  'reschedule writes exactly one new matching audit_log row'
);
select throws_ok(
  format($$ select reschedule_session(%L, '00000000-0000-0000-0000-000000000000', '2027-03-10 19:00:00+00'::timestamptz) $$, '66666666-0000-0000-0000-00000000e001'),
  null, 'session 00000000-0000-0000-0000-000000000000 not found',
  'rescheduling a nonexistent session raises'
);

-- cancel_session: reason required
select throws_ok(
  format($$ select cancel_session(%L, '55555555-0000-0000-0000-00000000e002', null) $$, '66666666-0000-0000-0000-00000000e001'),
  null, 'a cancellation reason is required',
  'cancelling without a reason raises'
);
select lives_ok(
  format($$ select cancel_session(%L, '55555555-0000-0000-0000-00000000e002', 'facilitator unavailable') $$, '66666666-0000-0000-0000-00000000e001'),
  'service_role can cancel a scheduled session with a reason'
);
select is(
  (select status::text from sessions where id = '55555555-0000-0000-0000-00000000e002'),
  'cancelled',
  'cancel sets status to cancelled'
);
select is(
  (select cancellation_reason from sessions where id = '55555555-0000-0000-0000-00000000e002'),
  'facilitator unavailable',
  'cancel records the reason'
);
select is(
  (select count(*)::int from audit_log where action = 'session_cancelled' and subject_type = 'session')
    - (select cancelled_n from audit_log_baseline),
  1,
  'cancel writes exactly one new matching audit_log row'
);
select throws_ok(
  format($$ select cancel_session(%L, '55555555-0000-0000-0000-00000000e002', 'again') $$, '66666666-0000-0000-0000-00000000e001'),
  null, 'session 55555555-0000-0000-0000-00000000e002 is not scheduled - only a scheduled session can be cancelled',
  'cancelling an already-cancelled session raises rather than double-cancelling'
);

-- record_session_substitute
select lives_ok(
  format($$ select record_session_substitute(%L, '55555555-0000-0000-0000-00000000e001', '66666666-0000-0000-0000-00000000e003') $$, '66666666-0000-0000-0000-00000000e001'),
  'service_role can record a substitute facilitator on a scheduled session'
);
select is(
  (select substitute_facilitator_id from sessions where id = '55555555-0000-0000-0000-00000000e001'),
  '66666666-0000-0000-0000-00000000e003'::uuid,
  'the substitute is recorded on the session'
);
select is(
  (select facilitator_id from cohorts where id = '77777777-0000-0000-0000-00000000e001'),
  '66666666-0000-0000-0000-00000000e002'::uuid,
  'the cohort''s own facilitator is untouched by recording a substitute'
);
select is(
  (select count(*)::int from audit_log where action = 'session_substitution_recorded' and subject_type = 'session')
    - (select substituted_n from audit_log_baseline),
  1,
  'recording a substitute writes exactly one new matching audit_log row'
);
select throws_ok(
  format($$ select record_session_substitute(%L, '55555555-0000-0000-0000-00000000e001', '66666666-0000-0000-0000-00000000e001') $$, '66666666-0000-0000-0000-00000000e001'),
  null, 'profile 66666666-0000-0000-0000-00000000e001 is not a facilitator',
  'recording a non-facilitator as a substitute still raises via the existing trigger'
);
select lives_ok(
  format($$ select record_session_substitute(%L, '55555555-0000-0000-0000-00000000e001', null) $$, '66666666-0000-0000-0000-00000000e001'),
  'passing null clears a previously-recorded substitute'
);
select is(
  (select substitute_facilitator_id from sessions where id = '55555555-0000-0000-0000-00000000e001'),
  null,
  'the substitute is actually cleared'
);
select throws_ok(
  format($$ select record_session_substitute(%L, '55555555-0000-0000-0000-00000000e002', '66666666-0000-0000-0000-00000000e003') $$, '66666666-0000-0000-0000-00000000e001'),
  null, 'session 55555555-0000-0000-0000-00000000e002 is not scheduled - a substitute can only be recorded on a scheduled session',
  'recording a substitute on a cancelled session raises'
);

-- Named-edge-case-style atomicity check: force the audit write to fail
-- (an actor with no matching profiles row) and confirm the session
-- mutation rolls back with it - same guarantee as every other atomic
-- function in this codebase.
select throws_ok(
  $$ select reschedule_session('00000000-0000-0000-0000-000000000000', '55555555-0000-0000-0000-00000000e001', '2027-04-01 18:30:00+00'::timestamptz) $$,
  '23503', null,
  'when the audit write fails (no matching actor profile), reschedule rolls back with it'
);
select isnt(
  (select scheduled_at from sessions where id = '55555555-0000-0000-0000-00000000e001'),
  '2027-04-01 18:30:00+00'::timestamptz,
  'the rolled-back reschedule left scheduled_at unchanged'
);

reset role;

select * from finish();
rollback;
