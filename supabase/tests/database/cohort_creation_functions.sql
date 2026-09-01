-- Coverage for finalize_cohort_sessions / mark_cohort_creation_failed -
-- the two DB-only halves of cohort creation (the Server Action in
-- between calls the real Zoom API, which can't run inside a pgTAP
-- transaction, so that part is covered by lib/admin/cohort-creation.test.ts
-- instead). Same methodology as every other suite here: real role
-- switches, never assumed; audit_log counts scoped by a baseline delta.

begin;
select plan(15);

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-00000000f001', 'pgTAP Finalize Program', 'Test Developer', 3, 90, array['video'], array['English'], 'Lay leader', 'licensed');

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-00000000f001', 'a3-func-admin@example.com'),
  ('66666666-0000-0000-0000-00000000f002', 'a3-func-facilitator@example.com');
update profiles set role = 'admin' where id = '66666666-0000-0000-0000-00000000f001';
update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-00000000f002';

-- A4-cert: cohorts.program_id + facilitator_id now require a current
-- certification (enforce_cohort_program_and_facilitator()) - without
-- this row, both inserts below would throw before this file's own
-- assertions ever ran.
insert into facilitator_certifications (facilitator_id, program_id, certified_on, expires_on, certifying_body) values
  ('66666666-0000-0000-0000-00000000f002', '99999999-0000-0000-0000-00000000f001', current_date - 30, current_date + 300, 'pgTAP Certifying Body');

insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, facilitator_id)
values
  ('77777777-0000-0000-0000-00000000f001', 'Finalize Success Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-00000000f001', '66666666-0000-0000-0000-00000000f002'),
  ('77777777-0000-0000-0000-00000000f002', 'Finalize Failure Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-00000000f001', '66666666-0000-0000-0000-00000000f002');

set local role authenticated;
select throws_ok(
  format(
    $$ select finalize_cohort_sessions(%L, '77777777-0000-0000-0000-00000000f001', 'zm-1', 'https://zoom.us/j/1', 'pass', null, null, array[now(), now() + interval '7 days', now() + interval '14 days']) $$,
    '66666666-0000-0000-0000-00000000f001'
  ),
  '42501', null,
  'authenticated cannot call finalize_cohort_sessions directly - execute not granted'
);
select throws_ok(
  format(
    $$ select mark_cohort_creation_failed(%L, '77777777-0000-0000-0000-00000000f002', 'boom') $$,
    '66666666-0000-0000-0000-00000000f001'
  ),
  '42501', null,
  'authenticated cannot call mark_cohort_creation_failed directly - execute not granted'
);
reset role;

set local role service_role;

create temporary table audit_log_baseline as
  select
    count(*) filter (where action = 'cohort_created')::int as created_n,
    count(*) filter (where action = 'cohort_creation_failed')::int as failed_n
  from audit_log
  where subject_type = 'cohort';

select lives_ok(
  format(
    $$ select finalize_cohort_sessions(%L, '77777777-0000-0000-0000-00000000f001', 'zm-1', 'https://zoom.us/j/1', 'pass', '+15551234567', '999999', array[now() + interval '1 day', now() + interval '8 days', now() + interval '15 days'], array['occ-1', 'occ-2', 'occ-3']) $$,
    '66666666-0000-0000-0000-00000000f001'
  ),
  'service_role can finalize a cohort''s sessions'
);

select is(
  (select array_agg(video_occurrence_id order by session_number) from sessions where cohort_id = '77777777-0000-0000-0000-00000000f001'),
  array['occ-1', 'occ-2', 'occ-3'],
  'each session stores its own matching Zoom occurrence id, in order'
);

select is(
  (select status::text from cohorts where id = '77777777-0000-0000-0000-00000000f001'),
  'active',
  'finalizing moves the cohort to active'
);

select is(
  (select count(*)::int from sessions where cohort_id = '77777777-0000-0000-0000-00000000f001'),
  3,
  'exactly three session rows were created, matching the three instants given'
);

select is(
  (select count(*)::int from sessions where cohort_id = '77777777-0000-0000-0000-00000000f001' and video_join_url = 'https://zoom.us/j/1'),
  3,
  'every session row carries the same recurring meeting''s join details'
);

select is(
  (select array_agg(session_number order by session_number) from sessions where cohort_id = '77777777-0000-0000-0000-00000000f001'),
  array[1, 2, 3],
  'session_number is assigned in order starting from 1'
);

select is(
  (select count(*)::int from audit_log where action = 'cohort_created' and subject_type = 'cohort')
    - (select created_n from audit_log_baseline),
  1,
  'finalizing writes exactly one new matching audit_log row'
);

select lives_ok(
  format(
    $$ select mark_cohort_creation_failed(%L, '77777777-0000-0000-0000-00000000f002', 'Zoom API returned 503') $$,
    '66666666-0000-0000-0000-00000000f001'
  ),
  'service_role can mark a cohort''s creation as failed'
);

select is(
  (select status::text from cohorts where id = '77777777-0000-0000-0000-00000000f002'),
  'draft',
  'a failed cohort stays in draft, not some other status'
);

select is(
  (select zoom_setup_error from cohorts where id = '77777777-0000-0000-0000-00000000f002'),
  'Zoom API returned 503',
  'the failure records the actual error message, not a generic one'
);

select is(
  (select count(*)::int from audit_log where action = 'cohort_creation_failed' and subject_type = 'cohort')
    - (select failed_n from audit_log_baseline),
  1,
  'marking a failure writes exactly one new matching audit_log row'
);

-- Named-edge-case-style atomicity check: force the audit write to fail
-- (an actor with no matching profiles row) and confirm zero session rows
-- get created - the same guarantee that makes "kill Zoom mid-creation"
-- structurally safe, exercised here at the one point sessions are ever
-- actually inserted.
select throws_ok(
  $$ select finalize_cohort_sessions(
       '00000000-0000-0000-0000-000000000000', '77777777-0000-0000-0000-00000000f002',
       'zm-2', 'https://zoom.us/j/2', 'pass', null, null,
       array[now(), now() + interval '7 days', now() + interval '14 days']) $$,
  '23503', null,
  'when the audit write fails (no matching actor profile), finalize rolls back with it'
);

select is(
  (select count(*)::int from sessions where cohort_id = '77777777-0000-0000-0000-00000000f002'),
  0,
  'the rolled-back finalize left no session rows behind'
);

reset role;

select * from finish();
rollback;
