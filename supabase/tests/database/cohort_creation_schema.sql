-- Coverage for A3's cohort/sessions schema: the program-licensing and
-- facilitator-role triggers (the two checks a plain CHECK constraint
-- can't express), and the new facilitator-scoped RLS policies on both
-- cohorts and sessions.

begin;
select plan(14);

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-00000000c001', 'pgTAP A3 Licensed', 'Test Developer', 6, 90, array['video'], array['English'], 'Lay leader', 'licensed'),
  ('99999999-0000-0000-0000-00000000c002', 'pgTAP A3 Not Licensed', 'Test Developer', 6, 90, array['video'], array['English'], 'Lay leader', 'not_licensed');

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-00000000a001', 'a3-admin@example.com'),
  ('66666666-0000-0000-0000-00000000a002', 'a3-facilitator-a@example.com'),
  ('66666666-0000-0000-0000-00000000a003', 'a3-facilitator-b@example.com'),
  ('66666666-0000-0000-0000-00000000a004', 'a3-member@example.com');

update profiles set role = 'admin' where id = '66666666-0000-0000-0000-00000000a001';
update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-00000000a002';
update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-00000000a003';
-- a004 stays 'member' (the default) - used as a non-facilitator for the
-- negative role-check assertions below.

-- program licensing trigger
select throws_ok(
  $$ insert into cohorts (name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id)
     values ('Bad Cohort', 'x', 5, 'Weekly', 2, '18:00', 'America/New_York', '99999999-0000-0000-0000-00000000c002') $$,
  null, 'program 99999999-0000-0000-0000-00000000c002 is not licensed - cohorts may only run on licensed programs',
  'creating a cohort on a not_licensed program raises'
);

select lives_ok(
  $$ insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id)
     values ('77777777-0000-0000-0000-00000000c001', 'Good Cohort', 'x', 5, 'Weekly', 2, '18:00', 'America/New_York', '99999999-0000-0000-0000-00000000c001') $$,
  'creating a cohort on a licensed program succeeds'
);

-- facilitator role trigger
select throws_ok(
  format(
    $$ update cohorts set facilitator_id = %L where id = '77777777-0000-0000-0000-00000000c001' $$,
    '66666666-0000-0000-0000-00000000a004'
  ),
  null, 'profile 66666666-0000-0000-0000-00000000a004 is not a facilitator',
  'assigning a non-facilitator profile as a cohort''s facilitator raises'
);

select lives_ok(
  format(
    $$ update cohorts set facilitator_id = %L where id = '77777777-0000-0000-0000-00000000c001' $$,
    '66666666-0000-0000-0000-00000000a002'
  ),
  'assigning a real facilitator profile succeeds'
);

-- cohorts RLS: admin sees everything, a facilitator sees only their own
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-00000000a001", "role": "authenticated"}';
select is(
  (select count(*)::int from cohorts where id = '77777777-0000-0000-0000-00000000c001'),
  1,
  'admin can read the cohort'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-00000000a002", "role": "authenticated"}';
select is(
  (select count(*)::int from cohorts where id = '77777777-0000-0000-0000-00000000c001'),
  1,
  'the assigned facilitator can read their own cohort'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-00000000a003", "role": "authenticated"}';
select is(
  (select count(*)::int from cohorts where id = '77777777-0000-0000-0000-00000000c001'),
  0,
  'a different facilitator cannot read a cohort that isn''t theirs'
);
reset role;

-- sessions: substitute-facilitator trigger + RLS
insert into sessions (id, cohort_id, session_number, scheduled_at)
values ('55555555-0000-0000-0000-00000000c001', '77777777-0000-0000-0000-00000000c001', 1, now() + interval '7 days');

select throws_ok(
  format(
    $$ update sessions set substitute_facilitator_id = %L where id = '55555555-0000-0000-0000-00000000c001' $$,
    '66666666-0000-0000-0000-00000000a004'
  ),
  null, 'profile 66666666-0000-0000-0000-00000000a004 is not a facilitator',
  'recording a non-facilitator as a session substitute raises'
);

select lives_ok(
  format(
    $$ update sessions set substitute_facilitator_id = %L where id = '55555555-0000-0000-0000-00000000c001' $$,
    '66666666-0000-0000-0000-00000000a003'
  ),
  'recording a real facilitator as a session substitute succeeds'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-00000000a001", "role": "authenticated"}';
select is(
  (select count(*)::int from sessions where id = '55555555-0000-0000-0000-00000000c001'),
  1,
  'admin can read the session'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-00000000a002", "role": "authenticated"}';
select is(
  (select count(*)::int from sessions where id = '55555555-0000-0000-0000-00000000c001'),
  1,
  'the cohort''s own facilitator can read the session, even though a3 was substituted in'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-00000000a003", "role": "authenticated"}';
select is(
  (select count(*)::int from sessions where id = '55555555-0000-0000-0000-00000000c001'),
  1,
  'the substitute facilitator can also read the session'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-00000000a004", "role": "authenticated"}';
select is(
  (select count(*)::int from sessions where id = '55555555-0000-0000-0000-00000000c001'),
  0,
  'an unrelated member cannot read the session'
);
reset role;

select throws_ok(
  $$ insert into sessions (cohort_id, session_number, scheduled_at)
     values ('77777777-0000-0000-0000-00000000c001', 1, now()) $$,
  '23505', null,
  'session_number is unique per cohort - a duplicate raises'
);

select * from finish();
rollback;

-- Negative-test drill, run by hand:
--   dropped policy "cohorts_select_own_facilitator" on cohorts
--   -> re-ran this file: "the assigned facilitator can read their own
--      cohort" failed ("have: 0, want: 1") - confirming that policy,
--      not the admin one, is what makes it possible.
--   restored the policy, supabase db reset --local
--   -> re-ran this file: all 14 assertions passed again.
--   Same drill repeated for "sessions_select_own_facilitator": dropped
--   it, both facilitator-read assertions on the session failed
--   ("have: 0, want: 1"), restored it, all passed again.
