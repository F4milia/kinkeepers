-- P5's own literal acceptance line: "every event fires from its real
-- trigger, verified by WALKING A SEEDED COHORT THROUGH SIX SESSIONS.
-- retention_at_session_6 returns a correct number against known seed
-- data." Found during a 2026-09-07 acceptance audit that no existing
-- test actually does this: analytics_events.sql's own header comment
-- documents (accurately, at the time it was written) that session_
-- attended/session_missed had no real trigger yet, so its own
-- retention_at_session(3/6) coverage seeds SYNTHETIC analytics_events
-- rows directly - a genuinely different claim from "the real trigger,
-- walked through six real sessions, produces the right number." X4
-- later gave session_attended/session_missed a real trigger
-- (submit_session_log(), 20260902110000) and session_attendance.sql's
-- own suite proves that trigger's correctness in isolation (one
-- session, the stale-event-correction fix) - but nothing walks a full
-- six-session cohort through it end to end the way this acceptance line
-- literally names. This suite is that walkthrough.
--
-- Four members, a realistic staggered drop-off (not everyone leaving at
-- once, which would make every session after the drop look identical):
--   A, B - attend all six sessions
--   C    - attends 1-3, drops after (absent 4-6)
--   D    - attends 1-2, drops after (absent 3-6)
-- So retention_at_session(3, cohort) = 3/4 = 75%, and
-- retention_at_session(6, cohort) = 2/4 = 50% - the exact acceptance-line
-- number, produced by six real submit_session_log() calls, not a
-- synthetic shortcut.

begin;
select plan(8);

insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-00000000e201', 'Retention Walkthrough Org', 'pgtap-retention-org');

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-00000000e201', 'pgTAP Retention Program', 'Test Developer', 6, 90, array['video'], array['English'], 'Lay leader', 'licensed');

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-00000000e201', 'retention-facilitator@example.com');
update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-00000000e201';

insert into facilitator_certifications (facilitator_id, program_id, certified_on, expires_on, certifying_body) values
  ('66666666-0000-0000-0000-00000000e201', '99999999-0000-0000-0000-00000000e201', current_date - 30, current_date + 300, 'pgTAP Certifying Body');

insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, facilitator_id) values
  ('77777777-0000-0000-0000-00000000e201', 'Retention Walkthrough Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-00000000e201', '66666666-0000-0000-0000-00000000e201');

insert into sessions (id, cohort_id, session_number, scheduled_at) values
  ('55555555-0000-0000-0000-00000000e211', '77777777-0000-0000-0000-00000000e201', 1, now() - interval '35 days'),
  ('55555555-0000-0000-0000-00000000e212', '77777777-0000-0000-0000-00000000e201', 2, now() - interval '28 days'),
  ('55555555-0000-0000-0000-00000000e213', '77777777-0000-0000-0000-00000000e201', 3, now() - interval '21 days'),
  ('55555555-0000-0000-0000-00000000e214', '77777777-0000-0000-0000-00000000e201', 4, now() - interval '14 days'),
  ('55555555-0000-0000-0000-00000000e215', '77777777-0000-0000-0000-00000000e201', 5, now() - interval '7 days'),
  ('55555555-0000-0000-0000-00000000e216', '77777777-0000-0000-0000-00000000e201', 6, now());

insert into applicants (id, partner_organization_id, referral_source, status, cohort_id, first_name) values
  ('33333333-0000-0000-0000-00000000e2a1', '11111111-0000-0000-0000-00000000e201', 'partner_link', 'attending', '77777777-0000-0000-0000-00000000e201', 'A'),
  ('33333333-0000-0000-0000-00000000e2a2', '11111111-0000-0000-0000-00000000e201', 'partner_link', 'attending', '77777777-0000-0000-0000-00000000e201', 'B'),
  ('33333333-0000-0000-0000-00000000e2a3', '11111111-0000-0000-0000-00000000e201', 'partner_link', 'attending', '77777777-0000-0000-0000-00000000e201', 'C'),
  ('33333333-0000-0000-0000-00000000e2a4', '11111111-0000-0000-0000-00000000e201', 'partner_link', 'attending', '77777777-0000-0000-0000-00000000e201', 'D');

set local role service_role;

-- The real trigger, walked through all six sessions - not a synthetic
-- record_analytics_event() shortcut.
select lives_ok(
  $$ select submit_session_log('66666666-0000-0000-0000-00000000e201', '55555555-0000-0000-0000-00000000e211', true, null, '[
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a1", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a2", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a3", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a4", "status": "present"}
  ]'::jsonb) $$,
  'session 1 logs all four present'
);
select lives_ok(
  $$ select submit_session_log('66666666-0000-0000-0000-00000000e201', '55555555-0000-0000-0000-00000000e212', true, null, '[
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a1", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a2", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a3", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a4", "status": "present"}
  ]'::jsonb) $$,
  'session 2 logs all four present'
);
select lives_ok(
  $$ select submit_session_log('66666666-0000-0000-0000-00000000e201', '55555555-0000-0000-0000-00000000e213', true, null, '[
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a1", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a2", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a3", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a4", "status": "absent"}
  ]'::jsonb) $$,
  'session 3 logs D as the first drop'
);
select lives_ok(
  $$ select submit_session_log('66666666-0000-0000-0000-00000000e201', '55555555-0000-0000-0000-00000000e214', true, null, '[
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a1", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a2", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a3", "status": "absent"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a4", "status": "absent"}
  ]'::jsonb) $$,
  'session 4 logs C as the second drop, D remains absent'
);
select lives_ok(
  $$ select submit_session_log('66666666-0000-0000-0000-00000000e201', '55555555-0000-0000-0000-00000000e215', true, null, '[
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a1", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a2", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a3", "status": "absent"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a4", "status": "absent"}
  ]'::jsonb) $$,
  'session 5 logs the same two-member steady state'
);
select lives_ok(
  $$ select submit_session_log('66666666-0000-0000-0000-00000000e201', '55555555-0000-0000-0000-00000000e216', true, null, '[
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a1", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a2", "status": "present"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a3", "status": "absent"},
    {"applicant_id": "33333333-0000-0000-0000-00000000e2a4", "status": "absent"}
  ]'::jsonb) $$,
  'session 6 - the acceptance line''s own named checkpoint'
);

-- The acceptance line's own two numbers, produced by the real trigger.
select is(
  (select retention_rate_percent from retention_at_session(3, '77777777-0000-0000-0000-00000000e201')),
  75.0,
  'retention_at_session_3, via six real submit_session_log() calls, is 75% - three of four still attending at session 3'
);
select is(
  (select retention_rate_percent from retention_at_session(6, '77777777-0000-0000-0000-00000000e201')),
  50.0,
  'retention_at_session_6, via six real submit_session_log() calls, is 50% - the acceptance line''s own required number, against real trigger data, not a synthetic shortcut'
);

select * from finish();
rollback;
