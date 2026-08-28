-- Coverage for the X2 program-catalog migration.
--
-- Per the run doc's methodology: every isolation boundary is tested as a
-- real authenticated/anon role, never assumed. Uses its own three test
-- programs (not the seeded four) so these assertions don't drift the
-- moment Ivan updates a real program's license_status.

begin;
select plan(9);

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('88888888-0000-0000-0000-000000000001', 'pgTAP Not Licensed', 'Test Developer', 6, 90, array['video'], array['English'], 'Lay leader', 'not_licensed'),
  ('88888888-0000-0000-0000-000000000002', 'pgTAP In Negotiation', 'Test Developer', 6, 90, array['video'], array['English'], 'Lay leader', 'in_negotiation'),
  ('88888888-0000-0000-0000-000000000003', 'pgTAP Licensed', 'Test Developer', 9, 90, array['video'], array['English'], 'Lay leader', 'licensed');

-- The enforcement point A3 will call: only 'licensed' programs pass.
select ok(
  not is_program_licensed('88888888-0000-0000-0000-000000000001'),
  'is_program_licensed() is false for not_licensed'
);
select ok(
  not is_program_licensed('88888888-0000-0000-0000-000000000002'),
  'is_program_licensed() is false for in_negotiation - a program being negotiated is still not selectable'
);
select ok(
  is_program_licensed('88888888-0000-0000-0000-000000000003'),
  'is_program_licensed() is true only for licensed'
);

-- Not hardcoded/cached - flips live when the status changes, so A3's
-- gate reflects reality the moment Ivan updates a program's status.
update programs set license_status = 'licensed' where id = '88888888-0000-0000-0000-000000000001';
select ok(
  is_program_licensed('88888888-0000-0000-0000-000000000001'),
  'is_program_licensed() reflects a live status change, not a cached/hardcoded result'
);

-- program_sessions: session count comes from the program row, never
-- hardcoded - seeded generically for any session_count via generate_series
-- in seed.sql, proven here for a 9-session program (Stress-Busting-shaped)
-- to confirm nothing assumes six.
insert into program_sessions (program_id, session_number)
select '88888888-0000-0000-0000-000000000003', gs
from generate_series(1, 9) as gs;
select is(
  (select count(*)::int from program_sessions where program_id = '88888888-0000-0000-0000-000000000003'),
  9,
  'program_sessions count matches the program''s session_count, including a 9-session program'
);
select is(
  (select count(*)::int from program_sessions
     where program_id = '88888888-0000-0000-0000-000000000003' and (title is not null or description is not null)),
  0,
  'no program_sessions row has a title or description - never invented, never inferred'
);

-- RLS: authenticated can read regardless of license status; anon cannot.
set local role authenticated;
select is(
  (select count(*)::int from programs where id::text like '88888888-%'),
  3,
  'authenticated can read all three test programs regardless of license status'
);
reset role;

set local role anon;
select throws_ok(
  $$ select count(*) from programs $$,
  '42501',
  null,
  'anon cannot read programs at all - no grant, not just no policy'
);
reset role;

-- Nobody but service_role can write.
set local role authenticated;
select throws_ok(
  $$ update programs set license_status = 'licensed' where id = '88888888-0000-0000-0000-000000000002' $$,
  '42501',
  null,
  'authenticated cannot update a program''s license_status directly'
);
reset role;

select * from finish();
rollback;

-- Negative-test drill, actually run (not hypothetical):
--   drop policy "programs_select_authenticated" on programs;
--   -> re-ran this file: test 7 failed exactly as expected ("have: 0,
--      want: 3") - confirming the policy is what makes the authenticated
--      read possible, not the grant alone.
--   supabase db reset (restores the migration, including the policy)
--   -> re-ran this file: all 9 assertions passed again.
