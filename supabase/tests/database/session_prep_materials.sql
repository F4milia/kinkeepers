-- F3: certification-gated session materials. Real role switches
-- throughout, never service_role for the access-control assertions - a
-- test authenticated as the service role bypasses RLS/the SECURITY
-- DEFINER checks entirely and would pass even with the gates removed.
--
-- The roster half of F3 (attendance counts, no per-member notes) has no
-- SQL-level test here on purpose: it's composed in lib/data.ts from two
-- already-audited access paths (X4's list_cohort_roster_for_facilitator
-- and session_attendance_select_own_facilitator), not a new function -
-- see lib/data.test.ts for that coverage instead.

begin;
select plan(6);

insert into partner_organizations (id, name, referral_link_slug) values
  ('44444444-0000-0000-0000-0000000f3001', 'pgTAP F3 Org', 'pgtap-f3-org');

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-0000000f3001', 'pgTAP F3 Program', 'Test Developer', 2, 90, array['video'], array['English'], 'Lay leader', 'licensed');

-- seed.sql's own program_sessions rows come from a generate_series
-- insert that only ran once, against the programs that existed at seed
-- time - a program inserted fresh inside this transaction needs its own
-- program_sessions rows, the same way a program inserted through the
-- real admin flow would.
insert into program_sessions (program_id, session_number) values
  ('99999999-0000-0000-0000-0000000f3001', 1),
  ('99999999-0000-0000-0000-0000000f3001', 2);

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-0000000f3001', 'f3-owner-certified@example.com'),
  ('66666666-0000-0000-0000-0000000f3002', 'f3-owner-uncertified@example.com'),
  ('66666666-0000-0000-0000-0000000f3003', 'f3-other-facilitator@example.com');

update profiles set role = 'facilitator' where id in (
  '66666666-0000-0000-0000-0000000f3001',
  '66666666-0000-0000-0000-0000000f3002',
  '66666666-0000-0000-0000-0000000f3003'
);

-- Both facilitators start certified, so enforce_cohort_program_and_
-- facilitator (A4-cert) allows assigning either to a cohort on this
-- program - it has no other way to exist. facilitator2's certification
-- then lapses (below, after both cohorts are created) to reach the
-- real scenario this test needs: a facilitator legitimately assigned to
-- a cohort whose certification has since expired, not one who could
-- never have been assigned at all.
insert into facilitator_certifications (id, facilitator_id, program_id, certified_on, expires_on, certifying_body) values
  ('22222222-0000-0000-0000-0000000f3001', '66666666-0000-0000-0000-0000000f3001', '99999999-0000-0000-0000-0000000f3001', current_date - 30, current_date + 300, 'pgTAP Certifying Body'),
  ('22222222-0000-0000-0000-0000000f3002', '66666666-0000-0000-0000-0000000f3002', '99999999-0000-0000-0000-0000000f3001', current_date - 30, current_date + 300, 'pgTAP Certifying Body');

insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, facilitator_id, status) values
  ('77777777-0000-0000-0000-0000000f3001', 'F3 Cohort (certified facilitator)', 'x', 8, 'weekly', 2, '18:00', 'America/New_York', '99999999-0000-0000-0000-0000000f3001', '66666666-0000-0000-0000-0000000f3001', 'active'),
  ('77777777-0000-0000-0000-0000000f3002', 'F3 Cohort (facilitator whose certification later lapses)', 'x', 8, 'weekly', 2, '18:00', 'America/New_York', '99999999-0000-0000-0000-0000000f3001', '66666666-0000-0000-0000-0000000f3002', 'active');

-- Now that both cohorts exist, facilitator2's certification expires -
-- they stay assigned to their cohort (reassignment isn't retroactively
-- undone by an expiry), but no longer counts as currently certified.
update facilitator_certifications set expires_on = current_date - 1
  where id = '22222222-0000-0000-0000-0000000f3002';

insert into sessions (id, cohort_id, session_number, scheduled_at) values
  ('55555555-0000-0000-0000-0000000f3002', '77777777-0000-0000-0000-0000000f3001', 2, current_date + 7),
  ('55555555-0000-0000-0000-0000000f3003', '77777777-0000-0000-0000-0000000f3002', 1, current_date + 7);

insert into session_materials (id, program_session_id, title, storage_path) values
  ('11111111-0000-0000-0000-0000000f3001', (select id from program_sessions where program_id = '99999999-0000-0000-0000-0000000f3001' and session_number = 2), 'Session 2 slides', 'placeholder/f3-session-2-slides.pdf');

-- The certified owner succeeds.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-0000000f3001", "role": "authenticated"}';
select is(
  (select count(*)::int from get_session_prep_materials('55555555-0000-0000-0000-0000000f3002')),
  1,
  'a currently-certified owning facilitator sees the session''s materials'
);
select is(
  (select storage_path from get_session_prep_materials('55555555-0000-0000-0000-0000000f3002') limit 1),
  'placeholder/f3-session-2-slides.pdf',
  'materials expose a storage_path, never a public URL - the caller must already be verified before this even runs'
);
reset role;

-- The UNCERTIFIED owner is blocked, with a named reason - the
-- acceptance criterion this whole file exists to prove.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-0000000f3002", "role": "authenticated"}';
select throws_ok(
  $$ select * from get_session_prep_materials('55555555-0000-0000-0000-0000000f3003') $$,
  null,
  'facilitator 66666666-0000-0000-0000-0000000f3002 is not currently certified for program 99999999-0000-0000-0000-0000000f3001',
  'an uncertified owning facilitator is blocked from materials, with a reason naming why'
);
reset role;

-- A non-owner is blocked before certification is even checked -
-- ownership is the first gate, not a fallback.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-0000000f3003", "role": "authenticated"}';
select throws_ok(
  $$ select * from get_session_prep_materials('55555555-0000-0000-0000-0000000f3002') $$,
  null,
  'session 55555555-0000-0000-0000-0000000f3002 is not yours to prep',
  'a non-owning facilitator is blocked from materials on ownership grounds, regardless of their own certification status'
);
reset role;

-- Table-level lockout: session_materials has no SELECT grant to
-- authenticated at all - a direct query fails at the grant level
-- (42501) before RLS is even evaluated, the same "grant-level block, not
-- just a policy-level one" distinction role_escalation.sql already
-- documents for profiles. Only the function above is a real path in.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-0000000f3001", "role": "authenticated"}';
select throws_ok(
  $$ select count(*) from session_materials $$,
  '42501', null,
  'session_materials is unreachable by direct query, even for its own owning facilitator - the function is the only door'
);
reset role;

-- anon can't call the function at all - the base grant is the deny, not
-- a policy.
set local role anon;
select throws_ok(
  $$ select * from get_session_prep_materials('55555555-0000-0000-0000-0000000f3002') $$,
  '42501', null,
  'anon cannot call get_session_prep_materials - execute not granted'
);
reset role;

select * from finish();
rollback;

-- Negative-test drill, actually run (not hypothetical):
--   commented out the ownership raise inside get_session_prep_materials,
--   `supabase db reset --local`, re-ran this file -> test 4 (non-owning
--   facilitator blocked) failed exactly as expected - not with "no
--   exception" but with the WRONG exception (the certification check
--   below it fired instead, since facilitator3 isn't certified either:
--   "caught: facilitator ... is not currently certified ... wanted: ...
--   is not yours to prep"). Confirms ownership is checked first and is
--   load-bearing on its own, not redundant with the certification check.
--   Restored, reset --local, all 6 passed again.
--   Repeated for the certification check alone (ownership restored,
--   only the certification raise commented out) -> test 3 (uncertified
--   owner blocked) failed with "caught: no exception, wanted: an
--   exception" - the materials query itself would have succeeded with
--   no gate at all. Restored, reset --local, all 6 passing again.
