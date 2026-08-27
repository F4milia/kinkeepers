-- Coverage for the P7a audit_log migration.
--
-- Per the run doc's methodology: every isolation boundary is tested as a
-- real authenticated/service_role role switch, never assumed. The named
-- edge case for this session - "force an audit insert to fail during a
-- mutation, the mutation rolls back" - gets its own worked example at the
-- bottom rather than being asserted abstractly.

begin;
select plan(12);

-- Three real auth users: an admin, a member, and the actor whose actions
-- get audited.
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'actor@example.com');

update profiles set role = 'admin' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- audit_log is append-only and actor_id -> profiles(id) has no ON DELETE
-- behavior (defaults to RESTRICT), so on a long-lived database (local or
-- hosted) other sessions' tests accumulate real, permanent rows here -
-- confirmed happening already (admin-issued-sign-in-link's own test suite
-- writes real rows every run). An absolute row count would go stale the
-- moment any other privileged-action code exists; a baseline-delta doesn't.
create temporary table audit_log_baseline as select count(*)::int as n from audit_log;

-- record_audit_event() covers all five privileged-action types this
-- session's acceptance criteria calls for.
select lives_ok(
  $$ select record_audit_event(
       'cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin_sign_in_link_issued',
       'member', 'm-1', 'phone verification', null) $$,
  'record_audit_event accepts admin_sign_in_link_issued'
);
select lives_ok(
  $$ select record_audit_event(
       'cccccccc-cccc-cccc-cccc-cccccccccccc', 'cohort_assignment',
       'member', 'm-1', null, '{"cohort_id": "c-1"}'::jsonb) $$,
  'record_audit_event accepts cohort_assignment'
);
select lives_ok(
  $$ select record_audit_event(
       'cccccccc-cccc-cccc-cccc-cccccccccccc', 'attendance_edit',
       'session', 's-1', 'corrected per facilitator request', null) $$,
  'record_audit_event accepts attendance_edit'
);
select lives_ok(
  $$ select record_audit_event(
       'cccccccc-cccc-cccc-cccc-cccccccccccc', 'deletion_fulfillment',
       'member', 'm-2', null, null) $$,
  'record_audit_event accepts deletion_fulfillment'
);
select lives_ok(
  $$ select record_audit_event(
       'cccccccc-cccc-cccc-cccc-cccccccccccc', 'role_change',
       'profile', 'p-1', 'promoted to facilitator', null) $$,
  'record_audit_event accepts role_change'
);

select is(
  (select count(*)::int from audit_log) - (select n from audit_log_baseline),
  5,
  'all five inserts landed as five new append-only rows (delta from baseline, not an absolute count)'
);

-- Hard deny for anon/authenticated - even an admin cannot read audit_log
-- via the anon-key client. Reading is server-side-only via service_role;
-- A5 owns the actual admin-facing screen and its own role check.
set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';
select throws_ok(
  $$ select count(*) from audit_log $$,
  '42501',
  null,
  'even an admin cannot query audit_log via the authenticated role - no grant, not just no policy'
);

set local request.jwt.claims to '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';
select throws_ok(
  $$ select count(*) from audit_log $$,
  '42501',
  null,
  'a non-admin member cannot query audit_log at all either'
);

select throws_ok(
  $$ select record_audit_event(
       'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role_change', 'profile', 'p-1', null, null) $$,
  '42501',
  null,
  'an authenticated user cannot call record_audit_event directly - execute not granted'
);
reset role;

-- Append-only: even service_role, which bypasses RLS entirely, cannot
-- UPDATE or DELETE - the guarantee lives in the GRANT, not the policy.
set local role service_role;
select throws_ok(
  $$ update audit_log set reason = 'edited' where id = 1 $$,
  '42501',
  null,
  'service_role cannot UPDATE audit_log despite bypassing RLS'
);
select throws_ok(
  $$ delete from audit_log where id = 1 $$,
  '42501',
  null,
  'service_role cannot DELETE from audit_log despite bypassing RLS'
);
reset role;

-- Named edge case: force an audit insert to fail during a mutation, and
-- prove the mutation rolls back with it. record_audit_event's actor_id has
-- a foreign key to profiles, so an actor_id with no matching profile row
-- forces a clean, deliberate failure. This DO block stands in for what a
-- real privileged-action function looks like: one transaction, the
-- business write and the audit write together. PL/pgSQL wraps a
-- BEGIN/EXCEPTION block in an implicit savepoint at entry, so catching the
-- exception here rolls back everything since block entry - including the
-- demo_mutation insert - which is exactly the atomicity this session's
-- named edge case is about.
create temporary table demo_mutation (id int primary key);

do $$
begin
  insert into demo_mutation values (1);
  perform record_audit_event(
    '00000000-0000-0000-0000-000000000000', -- no matching profiles row
    'attendance_edit', 'session', 's-99', null, null);
exception when foreign_key_violation then
  null; -- swallow; the implicit savepoint already undid both statements
end;
$$;

select is(
  (select count(*)::int from demo_mutation),
  0,
  'when the audit write fails inside the same transaction, the co-occurring mutation rolls back too'
);

select * from finish();
rollback;
