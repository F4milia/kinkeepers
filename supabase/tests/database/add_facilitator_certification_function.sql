-- Coverage for A4-cert's write side: add_facilitator_certification().

begin;
select plan(8);

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-00000000b001', 'pgTAP A4 Function Program', 'Test Developer', 6, 90, array['video'], array['English'], 'Lay leader', 'licensed');

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-00000000b001', 'a4-func-admin@example.com'),
  ('66666666-0000-0000-0000-00000000b002', 'a4-func-facilitator@example.com'),
  ('66666666-0000-0000-0000-00000000b003', 'a4-func-member@example.com');

update profiles set role = 'admin' where id = '66666666-0000-0000-0000-00000000b001';
update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-00000000b002';
-- b003 stays 'member' - the non-facilitator negative case below.

set local role authenticated;
select throws_ok(
  format(
    $$ select add_facilitator_certification(%L, '66666666-0000-0000-0000-00000000b002', '99999999-0000-0000-0000-00000000b001', current_date, current_date + 300, 'Test Body') $$,
    '66666666-0000-0000-0000-00000000b001'
  ),
  '42501', null,
  'authenticated cannot call add_facilitator_certification directly'
);
reset role;

set local role service_role;

create temporary table audit_log_baseline as
  select count(*)::int as n from audit_log where action = 'facilitator_certified';

select throws_ok(
  format(
    $$ select add_facilitator_certification(%L, '66666666-0000-0000-0000-00000000b003', '99999999-0000-0000-0000-00000000b001', current_date, current_date + 300, 'Test Body') $$,
    '66666666-0000-0000-0000-00000000b001'
  ),
  null, 'profile 66666666-0000-0000-0000-00000000b003 is not a facilitator',
  'certifying a non-facilitator profile raises'
);

select throws_ok(
  format(
    $$ select add_facilitator_certification(%L, '66666666-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-000000000000', current_date, current_date + 300, 'Test Body') $$,
    '66666666-0000-0000-0000-00000000b001'
  ),
  null, 'program 00000000-0000-0000-0000-000000000000 not found',
  'certifying for a nonexistent program raises'
);

select lives_ok(
  format(
    $$ select add_facilitator_certification(%L, '66666666-0000-0000-0000-00000000b002', '99999999-0000-0000-0000-00000000b001', current_date, current_date + 300, 'Test Body') $$,
    '66666666-0000-0000-0000-00000000b001'
  ),
  'a valid certification can be recorded'
);

select is(
  (select count(*)::int from facilitator_certifications
     where facilitator_id = '66666666-0000-0000-0000-00000000b002'
       and program_id = '99999999-0000-0000-0000-00000000b001'),
  1,
  'the certification row was actually written'
);

select is(
  (select count(*)::int from audit_log where action = 'facilitator_certified')
    - (select n from audit_log_baseline),
  1,
  'exactly one new facilitator_certified audit_log row was written'
);

select is(
  (select metadata ->> 'facilitator_id' from audit_log where action = 'facilitator_certified' order by created_at desc limit 1),
  '66666666-0000-0000-0000-00000000b002',
  'the audit row records which facilitator was certified'
);

-- Invalid date range: expires_on must be after certified_on (table CHECK) -
-- confirms the function doesn't bypass it, and no audit row is written for
-- a failed insert (same transaction, so the whole call rolls back together).
select throws_ok(
  format(
    $$ select add_facilitator_certification(%L, '66666666-0000-0000-0000-00000000b002', '99999999-0000-0000-0000-00000000b001', current_date, current_date - 1, 'Test Body') $$,
    '66666666-0000-0000-0000-00000000b001'
  ),
  '23514', null,
  'expires_on before certified_on is rejected by the table check constraint'
);

reset role;

select * from finish();
rollback;
