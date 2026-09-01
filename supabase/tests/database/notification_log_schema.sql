-- Coverage for notification_log's dedup guarantee and grant-level
-- access control (P4). The unique (dedup_key, channel) index is what
-- actually makes "duplicate job runs send once" true - this proves
-- Postgres itself rejects the second attempt, not just application code.

begin;
select plan(6);

insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-0000000000a1', 'Notification Log Test Org', 'pgtap-notification-log-org');

insert into applicants (id, partner_organization_id, referral_source, status, email) values
  ('33333333-0000-0000-0000-0000000000a1', '11111111-0000-0000-0000-0000000000a1', 'partner_link', 'enrolled', 'member@example.com');

set local role service_role;

select lives_ok(
  $$ insert into notification_log (applicant_id, notification_type, channel, status, dedup_key)
     values ('33333333-0000-0000-0000-0000000000a1', 'session_rescheduled', 'email', 'sent', 'dedup-key-1') $$,
  'service_role can insert a notification_log row'
);

select throws_ok(
  $$ insert into notification_log (applicant_id, notification_type, channel, status, dedup_key)
     values ('33333333-0000-0000-0000-0000000000a1', 'session_rescheduled', 'email', 'sent', 'dedup-key-1') $$,
  '23505', null,
  'a second insert with the same (dedup_key, channel) is rejected - this is what makes duplicate sends impossible'
);

select lives_ok(
  $$ insert into notification_log (applicant_id, notification_type, channel, status, dedup_key)
     values ('33333333-0000-0000-0000-0000000000a1', 'session_rescheduled', 'sms', 'sent', 'dedup-key-1') $$,
  'the SAME dedup_key with a DIFFERENT channel is allowed - email and sms are tracked independently'
);

select throws_ok(
  $$ insert into notification_log (applicant_id, notification_type, channel, status, dedup_key)
     values ('33333333-0000-0000-0000-0000000000a1', 'session_rescheduled', 'carrier_pigeon', 'sent', 'dedup-key-2') $$,
  '23514', null,
  'an unrecognized channel value is rejected by the check constraint'
);

reset role;

set local role authenticated;
select throws_ok(
  $$ select count(*) from notification_log $$,
  '42501', null,
  'authenticated cannot read notification_log at all - admin-only, same as audit_log and member_data_requests'
);
reset role;

set local role anon;
select throws_ok(
  $$ select count(*) from notification_log $$,
  '42501', null,
  'anon cannot read notification_log at all'
);
reset role;

select * from finish();
rollback;
