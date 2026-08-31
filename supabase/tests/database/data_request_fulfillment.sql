-- Coverage for mark_data_request_fulfilled (A5 PR2). Same methodology as
-- every other suite here: real role switches, never assumed; audit_log
-- counts scoped by a baseline delta.

begin;
select plan(12);

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-00000000d101', 'a5-dr-admin@example.com'),
  ('66666666-0000-0000-0000-00000000d102', 'a5-dr-member@example.com');
update profiles set role = 'admin' where id = '66666666-0000-0000-0000-00000000d101';

insert into member_data_requests (id, member_id, request_type, status) values
  ('33333333-0000-0000-0000-00000000d101', '66666666-0000-0000-0000-00000000d102', 'deletion', 'pending'),
  ('33333333-0000-0000-0000-00000000d102', '66666666-0000-0000-0000-00000000d102', 'export', 'pending');

set local role authenticated;
select throws_ok(
  format(
    $$ select mark_data_request_fulfilled(%L, '33333333-0000-0000-0000-00000000d101', 'done') $$,
    '66666666-0000-0000-0000-00000000d101'
  ),
  '42501', null,
  'authenticated cannot call mark_data_request_fulfilled directly - execute not granted'
);
reset role;

set local role service_role;

create temporary table audit_log_baseline as
  select count(*)::int as fulfilled_n
  from audit_log
  where subject_type = 'member_data_request' and action = 'member_data_request_fulfilled';

select throws_ok(
  format(
    $$ select mark_data_request_fulfilled(%L, '33333333-0000-0000-0000-00000000d101', null) $$,
    '66666666-0000-0000-0000-00000000d101'
  ),
  null, 'a fulfillment note is required',
  'fulfilling without a note raises'
);

select throws_ok(
  format(
    $$ select mark_data_request_fulfilled(%L, '33333333-0000-0000-0000-00000000d101', '   ') $$,
    '66666666-0000-0000-0000-00000000d101'
  ),
  null, 'a fulfillment note is required',
  'fulfilling with a whitespace-only note raises the same way'
);

select lives_ok(
  format(
    $$ select mark_data_request_fulfilled(%L, '33333333-0000-0000-0000-00000000d101', 'Anonymized applicant record per policy') $$,
    '66666666-0000-0000-0000-00000000d101'
  ),
  'service_role can mark a pending deletion request fulfilled with a note'
);

select is(
  (select status::text from member_data_requests where id = '33333333-0000-0000-0000-00000000d101'),
  'fulfilled',
  'the request status is updated to fulfilled'
);
select is(
  (select fulfillment_note from member_data_requests where id = '33333333-0000-0000-0000-00000000d101'),
  'Anonymized applicant record per policy',
  'the fulfillment note is recorded verbatim'
);
select is(
  (select fulfilled_at is not null from member_data_requests where id = '33333333-0000-0000-0000-00000000d101'),
  true,
  'fulfilled_at is stamped'
);
select is(
  (select count(*)::int from audit_log where subject_type = 'member_data_request' and action = 'member_data_request_fulfilled')
    - (select fulfilled_n from audit_log_baseline),
  1,
  'fulfilling writes exactly one new matching audit_log row'
);

select throws_ok(
  format(
    $$ select mark_data_request_fulfilled(%L, '33333333-0000-0000-0000-00000000d101', 'again') $$,
    '66666666-0000-0000-0000-00000000d101'
  ),
  null, 'data request 33333333-0000-0000-0000-00000000d101 is not pending - only a pending request can be marked fulfilled',
  'an already-fulfilled request cannot be marked fulfilled again'
);

-- The export request (a separate row) is untouched by fulfilling the
-- deletion request above - confirms the guard scopes by id, not by
-- member_id or a blanket "this member's requests."
select is(
  (select status::text from member_data_requests where id = '33333333-0000-0000-0000-00000000d102'),
  'pending',
  'a different pending request for the same member is untouched'
);

-- Named-edge-case-style atomicity check: force the audit write to fail
-- (an actor with no matching profiles row) and confirm the request
-- rolls back with it.
select throws_ok(
  $$ select mark_data_request_fulfilled(
       '00000000-0000-0000-0000-000000000000', '33333333-0000-0000-0000-00000000d102', 'export sent') $$,
  '23503', null,
  'when the audit write fails (no matching actor profile), fulfillment rolls back with it'
);

select is(
  (select status::text from member_data_requests where id = '33333333-0000-0000-0000-00000000d102'),
  'pending',
  'the rolled-back fulfillment left the export request exactly as it was'
);

reset role;

select * from finish();
rollback;
