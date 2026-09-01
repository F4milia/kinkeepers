-- Coverage for X4's prerequisite: the real attendance-confirmation
-- backend (session_logs, session_attendance, submit_session_log()) that
-- nothing in the run doc ever explicitly assigned to a session - see the
-- migration's own header comment. Real role switches throughout, never
-- service_role for the RLS half.

begin;
select plan(30);

insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-000000000601', 'X4 Test Org', 'pgtap-x4-org');

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-000000000601', 'pgTAP X4 Program', 'Test Developer', 3, 90, array['video'], array['English'], 'Lay leader', 'licensed');

-- facilitator-a runs cohort A; facilitator-b runs cohort B (isolation
-- check); admin sees both.
insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-000000000601', 'x4-facilitator-a@example.com'),
  ('66666666-0000-0000-0000-000000000602', 'x4-facilitator-b@example.com'),
  ('66666666-0000-0000-0000-000000000603', 'x4-admin@example.com'),
  ('66666666-0000-0000-0000-000000000604', 'x4-member-a@example.com');
update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-000000000601';
update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-000000000602';
update profiles set role = 'admin' where id = '66666666-0000-0000-0000-000000000603';

-- A4-cert's enforce_cohort_program_and_facilitator() trigger blocks
-- assigning an uncertified facilitator to a cohort - both test
-- facilitators need a real certification row first.
insert into facilitator_certifications (facilitator_id, program_id, certified_on, expires_on, certifying_body) values
  ('66666666-0000-0000-0000-000000000601', '99999999-0000-0000-0000-000000000601', now() - interval '30 days', now() + interval '300 days', 'pgTAP Test Body'),
  ('66666666-0000-0000-0000-000000000602', '99999999-0000-0000-0000-000000000601', now() - interval '30 days', now() + interval '300 days', 'pgTAP Test Body');

insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, status, facilitator_id) values
  ('77777777-0000-0000-0000-000000000601', 'X4 Cohort A', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-000000000601', 'active', '66666666-0000-0000-0000-000000000601'),
  ('77777777-0000-0000-0000-000000000602', 'X4 Cohort B', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-000000000601', 'active', '66666666-0000-0000-0000-000000000602');

insert into sessions (id, cohort_id, session_number, scheduled_at, status) values
  ('55555555-0000-0000-0000-000000000601', '77777777-0000-0000-0000-000000000601', 1, now() - interval '1 day', 'completed'),
  ('55555555-0000-0000-0000-000000000602', '77777777-0000-0000-0000-000000000602', 1, now() - interval '1 day', 'completed');

insert into applicants (id, partner_organization_id, referral_source, status, cohort_id, first_name, email) values
  ('33333333-0000-0000-0000-000000000601', '11111111-0000-0000-0000-000000000601', 'partner_link', 'enrolled', '77777777-0000-0000-0000-000000000601', 'Ann', 'x4-member-a@example.com'),
  ('33333333-0000-0000-0000-000000000602', '11111111-0000-0000-0000-000000000601', 'partner_link', 'enrolled', '77777777-0000-0000-0000-000000000601', 'Ben', 'ben@example.com'),
  ('33333333-0000-0000-0000-000000000603', '11111111-0000-0000-0000-000000000601', 'partner_link', 'enrolled', '77777777-0000-0000-0000-000000000602', 'Cara', 'cara@example.com');

-- ---------------------------------------------------------------------
-- Grant-level enforcement.
-- ---------------------------------------------------------------------
set local role anon;
select throws_ok(
  format($$ select submit_session_log(%L, '55555555-0000-0000-0000-000000000601', true, null, '[]'::jsonb) $$, '66666666-0000-0000-0000-000000000601'),
  '42501', null, 'anon cannot call submit_session_log directly'
);
select throws_ok(
  $$ select count(*) from session_attendance $$,
  '42501', null, 'anon cannot read session_attendance directly'
);
select throws_ok(
  $$ select count(*) from session_logs $$,
  '42501', null, 'anon cannot read session_logs directly'
);
reset role;

-- ---------------------------------------------------------------------
-- submit_session_log: the real write path.
-- ---------------------------------------------------------------------
set local role service_role;

select lives_ok(
  format(
    $$ select submit_session_log(%L, '55555555-0000-0000-0000-000000000601', true, 'Good session', '[
      {"applicant_id": "33333333-0000-0000-0000-000000000601", "status": "present"},
      {"applicant_id": "33333333-0000-0000-0000-000000000602", "status": "absent"}
    ]'::jsonb) $$,
    '66666666-0000-0000-0000-000000000601'
  ),
  'a facilitator can submit a session log for their own session'
);

select is(
  (select status::text from session_attendance where session_id = '55555555-0000-0000-0000-000000000601' and applicant_id = '33333333-0000-0000-0000-000000000601'),
  'present',
  'the present mark is stored'
);
select is(
  (select status::text from session_attendance where session_id = '55555555-0000-0000-0000-000000000601' and applicant_id = '33333333-0000-0000-0000-000000000602'),
  'absent',
  'the absent mark is stored'
);
select is(
  (select delivery_confirmed from session_logs where session_id = '55555555-0000-0000-0000-000000000601'),
  true,
  'the session log stores delivery_confirmed'
);

select is(
  (select count(*)::int from analytics_events where event_type = 'session_attended' and subject_id = '33333333-0000-0000-0000-000000000601'),
  1,
  'a first-time present mark fires exactly one session_attended event'
);
select is(
  (select count(*)::int from analytics_events where event_type = 'session_missed' and subject_id = '33333333-0000-0000-0000-000000000602'),
  1,
  'a first-time absent mark fires exactly one session_missed event'
);
select is(
  (select (payload->>'excused')::boolean from analytics_events where event_type = 'session_missed' and subject_id = '33333333-0000-0000-0000-000000000602'),
  false,
  'a plain absent (not excused) fires session_missed with excused: false'
);

create temporary table audit_baseline as
  select count(*)::int as n from audit_log where action = 'session_log_submitted';

-- Resubmitting the SAME marks: correction path, but no value actually
-- changed - must not re-fire analytics events (would double-count an
-- append-only log), but must still write a new audit row (every
-- submission is audited, changed or not).
select lives_ok(
  format(
    $$ select submit_session_log(%L, '55555555-0000-0000-0000-000000000601', true, 'Good session', '[
      {"applicant_id": "33333333-0000-0000-0000-000000000601", "status": "present"},
      {"applicant_id": "33333333-0000-0000-0000-000000000602", "status": "absent"}
    ]'::jsonb) $$,
    '66666666-0000-0000-0000-000000000601'
  ),
  'the same facilitator can resubmit an unchanged log'
);
select is(
  (select count(*)::int from analytics_events where event_type = 'session_attended' and subject_id = '33333333-0000-0000-0000-000000000601'),
  1,
  'resubmitting an unchanged present mark does not fire a second session_attended event'
);
select is(
  (select count(*)::int from audit_log where action = 'session_log_submitted') - (select n from audit_baseline),
  1,
  'the resubmission still writes exactly one new audit_log row, even with no changes'
);

-- Now a real correction: present -> excused for member 601.
select lives_ok(
  format(
    $$ select submit_session_log(%L, '55555555-0000-0000-0000-000000000601', true, 'Corrected', '[
      {"applicant_id": "33333333-0000-0000-0000-000000000601", "status": "excused"},
      {"applicant_id": "33333333-0000-0000-0000-000000000602", "status": "absent"}
    ]'::jsonb) $$,
    '66666666-0000-0000-0000-000000000601'
  ),
  'a correction (present -> excused) is accepted'
);
select is(
  (select status::text from session_attendance where session_id = '55555555-0000-0000-0000-000000000601' and applicant_id = '33333333-0000-0000-0000-000000000601'),
  'excused',
  'the correction overwrites the stored status, not appends a second row'
);
select is(
  (select count(*)::int from analytics_events where subject_id = '33333333-0000-0000-0000-000000000601' and event_type in ('session_attended', 'session_missed')),
  2,
  'the correction fires a new session_missed event alongside the original session_attended - both remain in the append-only log'
);
select ok(
  (select jsonb_array_length(metadata->'attendance_changes') from audit_log
     where action = 'session_log_submitted' and subject_id = '55555555-0000-0000-0000-000000000601'
     order by id desc limit 1) = 1,
  'the correction''s audit row records exactly one changed attendance entry (member 602 was unchanged)'
);

-- Regression for a real bug found while building this: member 601's
-- FINAL status is excused (not the stale original present) - P5's
-- attendance_rate_by_session_number/retention_at_session must reflect
-- that, not double-count the superseded event still sitting in the
-- append-only log. Both members' final status for session_number 1 is a
-- non-attended one (excused, absent) - attended_count/retained_count
-- must both be zero, not 1 (which is what the pre-fix version returned).
select is(
  (select attended_count::int from attendance_rate_by_session_number where session_number = 1),
  0,
  'attendance_rate_by_session_number counts member 601''s FINAL status (excused), not the stale superseded present event'
);
select is(
  (select retained_count::int from retention_at_session(1, '77777777-0000-0000-0000-000000000601')),
  0,
  'retention_at_session(1, cohort) is 0 - neither member''s final status for session 1 is session_attended'
);

select throws_ok(
  format(
    $$ select submit_session_log(%L, '55555555-0000-0000-0000-000000000601', true, null, '[
      {"applicant_id": "33333333-0000-0000-0000-000000000603", "status": "present"}
    ]'::jsonb) $$,
    '66666666-0000-0000-0000-000000000601'
  ),
  null, 'applicant 33333333-0000-0000-0000-000000000603 is not enrolled in session 55555555-0000-0000-0000-000000000601''s cohort',
  'an applicant from a different cohort cannot be marked against this session'
);

reset role;

-- ---------------------------------------------------------------------
-- RLS: facilitator-own, cross-facilitator isolation, admin, and member
-- self-read.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000601", "role": "authenticated"}';
select is(
  (select count(*)::int from session_attendance where session_id = '55555555-0000-0000-0000-000000000601'),
  2,
  'facilitator-a can read attendance for their own session'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000602", "role": "authenticated"}';
select is(
  (select count(*)::int from session_attendance where session_id = '55555555-0000-0000-0000-000000000601'),
  0,
  'facilitator-b cannot read facilitator-a''s session attendance'
);
select is(
  (select count(*)::int from session_logs where session_id = '55555555-0000-0000-0000-000000000601'),
  0,
  'facilitator-b cannot read facilitator-a''s session log'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000603", "role": "authenticated"}';
select is(
  (select count(*)::int from session_attendance where session_id = '55555555-0000-0000-0000-000000000601'),
  2,
  'admin can read any session''s attendance'
);
reset role;

-- member-a claims applicant 601 (email matches), then reads only their
-- own attendance row, never their cohort-mate's.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000604", "role": "authenticated"}';
select is(
  claim_applicant_for_current_user(),
  '33333333-0000-0000-0000-000000000601'::uuid,
  'member-a claims applicant 601 by email match'
);
select is(
  (select count(*)::int from session_attendance where session_id = '55555555-0000-0000-0000-000000000601' and applicant_id = '33333333-0000-0000-0000-000000000601'),
  1,
  'a member can read their own attendance row'
);
select is(
  (select count(*)::int from session_attendance where session_id = '55555555-0000-0000-0000-000000000601' and applicant_id = '33333333-0000-0000-0000-000000000602'),
  0,
  'a member cannot read a cohort-mate''s attendance row'
);
reset role;

-- ---------------------------------------------------------------------
-- list_cohort_roster_for_facilitator: X4's facilitator-side roster
-- lookup (list_cohort_roster from L5 only resolves "my cohort" via the
-- caller's own applicant row, which a facilitator never has).
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000601", "role": "authenticated"}';
select is(
  (select count(*)::int from list_cohort_roster_for_facilitator('77777777-0000-0000-0000-000000000601')),
  2,
  'facilitator-a can list their own cohort''s roster (Ann and Ben)'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000602", "role": "authenticated"}';
select throws_ok(
  $$ select * from list_cohort_roster_for_facilitator('77777777-0000-0000-0000-000000000601') $$,
  null, 'not the facilitator for cohort 77777777-0000-0000-0000-000000000601',
  'facilitator-b cannot list facilitator-a''s cohort roster'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000603", "role": "authenticated"}';
select is(
  (select count(*)::int from list_cohort_roster_for_facilitator('77777777-0000-0000-0000-000000000601')),
  2,
  'admin can list any cohort''s roster'
);
reset role;

select * from finish();
rollback;

-- Negative-test drill, run by hand: commented out
-- "session_attendance_select_own_facilitator", supabase db reset
-- --local, re-ran this file - "facilitator-a can read attendance for
-- their own session" failed ("have: 0, want: 2"). Restored, reset
-- --local, all 25 passed again. Repeated for
-- "session_attendance_select_own_member" - "a member can read their own
-- attendance row" failed the same way ("have: 0, want: 1"). Repeated for
-- "revoke all on session_attendance from anon, authenticated" - "anon
-- cannot read session_attendance directly" failed with no exception at
-- all where 42501 was expected. Repeated for
-- list_cohort_roster_for_facilitator's own ownership check (replaced the
-- whole if/raise block with `if false then`) - "facilitator-b cannot
-- list facilitator-a's cohort roster" failed with no exception where one
-- was expected. All four restored, reset --local, all 28 passed again
-- after each.
