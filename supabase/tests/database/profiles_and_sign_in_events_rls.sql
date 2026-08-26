-- RLS coverage for the P1 profiles/sign_in_events migration.
--
-- Per the run doc's methodology: every isolation boundary is tested as a
-- real authenticated user (never the service role, which bypasses RLS and
-- would make these tests pass regardless of policy correctness).

begin;
select plan(4);

-- Two real auth users, so we can prove one cannot read the other's role.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'user-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@example.com');

-- profiles rows for both should already exist via the handle_new_user
-- trigger; assert that instead of inserting directly, so this test also
-- covers the trigger firing.
select is(
  (select count(*)::int from profiles where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'handle_new_user trigger created a profile row for user A'
);

-- Act as user A via a real JWT-equivalent role switch, not service_role.
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from profiles where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'user A can read their own profile row'
);

select is(
  (select count(*)::int from profiles where id = '22222222-2222-2222-2222-222222222222'),
  0,
  'user A cannot read user B''s profile row'
);

select throws_ok(
  $$ select count(*) from sign_in_events $$,
  '42501',
  null,
  'an authenticated user cannot query sign_in_events at all - no grant, not just no policy'
);

select * from finish();
rollback;
