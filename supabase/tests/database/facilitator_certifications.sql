-- Coverage for A4-cert: certification-gated cohort assignment, and RLS
-- on facilitator_certifications itself.

begin;
select plan(8);

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-00000000d001', 'pgTAP A4 Licensed', 'Test Developer', 6, 90, array['video'], array['English'], 'Lay leader', 'licensed');

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-00000000d001', 'a4-facilitator-a@example.com'),
  ('66666666-0000-0000-0000-00000000d002', 'a4-facilitator-b@example.com');

update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-00000000d001';
update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-00000000d002';

-- Not yet certified: blocked, with a reason.
select throws_ok(
  $$ insert into cohorts (name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, facilitator_id)
     values ('Uncertified Cohort', 'x', 5, 'weekly', 2, '18:00', 'America/New_York',
       '99999999-0000-0000-0000-00000000d001', '66666666-0000-0000-0000-00000000d001') $$,
  null, 'facilitator 66666666-0000-0000-0000-00000000d001 is not currently certified for program 99999999-0000-0000-0000-00000000d001',
  'assigning an uncertified facilitator to a cohort raises, and says why'
);

select lives_ok(
  $$ insert into facilitator_certifications (facilitator_id, program_id, certified_on, expires_on, certifying_body)
     values ('66666666-0000-0000-0000-00000000d001', '99999999-0000-0000-0000-00000000d001',
       current_date - 30, current_date + 300, 'pgTAP Certifying Body') $$,
  'a current certification can be recorded'
);

select lives_ok(
  $$ insert into cohorts (name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, facilitator_id)
     values ('Certified Cohort', 'x', 5, 'weekly', 2, '18:00', 'America/New_York',
       '99999999-0000-0000-0000-00000000d001', '66666666-0000-0000-0000-00000000d001') $$,
  'assigning a currently-certified facilitator to the same program now succeeds'
);

-- Expired (not just missing) also blocks - the check is expires_on >=
-- current_date, not merely "a row exists".
select lives_ok(
  $$ insert into facilitator_certifications (facilitator_id, program_id, certified_on, expires_on, certifying_body)
     values ('66666666-0000-0000-0000-00000000d002', '99999999-0000-0000-0000-00000000d001',
       current_date - 400, current_date - 30, 'pgTAP Certifying Body') $$,
  'an expired certification can still be recorded (a real history, not hidden)'
);

select throws_ok(
  $$ insert into cohorts (name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, facilitator_id)
     values ('Expired Cert Cohort', 'x', 5, 'weekly', 2, '18:00', 'America/New_York',
       '99999999-0000-0000-0000-00000000d001', '66666666-0000-0000-0000-00000000d002') $$,
  null, 'facilitator 66666666-0000-0000-0000-00000000d002 is not currently certified for program 99999999-0000-0000-0000-00000000d001',
  'an expired certification does not count as current - still blocked'
);

-- RLS: a facilitator can read their own certification, not another's.
-- Paired positive control (own-read) alongside the cross-read, per the
-- P6 lesson: without it, "sees 0 of the other's rows" would pass
-- identically whether isolation is real or the policy is simply missing.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-00000000d001", "role": "authenticated"}';
select is(
  (select count(*)::int from facilitator_certifications where facilitator_id = '66666666-0000-0000-0000-00000000d001'),
  1,
  'facilitator A can read their own certification'
);
select is(
  (select count(*)::int from facilitator_certifications where facilitator_id = '66666666-0000-0000-0000-00000000d002'),
  0,
  'facilitator A cannot read facilitator B''s certification'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-00000000d002", "role": "authenticated"}';
select is(
  (select count(*)::int from facilitator_certifications where facilitator_id = '66666666-0000-0000-0000-00000000d002'),
  1,
  'facilitator B can read their own certification - the paired positive control'
);
reset role;

select * from finish();
rollback;

-- Negative-test drill, actually run (not hypothetical):
--   drop policy "facilitator_certifications_select_own" on facilitator_certifications;
--   -> re-ran this file: tests 6 and 8 (the positive controls) failed as
--      expected ("have: 0, want: 1") - test 7 (cross-read = 0) still
--      passed, same reasoning P6 already documented: it would pass
--      identically whether isolation is real or the policy is gone,
--      since facilitator A never had facilitator B's row to see either
--      way. The positive controls are what actually prove it.
--   supabase db reset (restores the migration, including the policy)
--   -> re-ran this file: all 8 assertions passed again.
