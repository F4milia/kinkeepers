-- Coverage for notification_log's dedup guarantee and grant-level
-- access control (P4). The unique (dedup_key, channel) index is what
-- actually makes "duplicate job runs send once" true - this proves
-- Postgres itself rejects the second attempt, not just application code.

begin;
select plan(8);

insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-0000000000a1', 'Notification Log Test Org', 'pgtap-notification-log-org');

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-0000000000a1', 'Notification Log Test Program', 'Test Developer', 1, 90, array['video'], array['English'], 'Lay leader', 'licensed');

insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id) values
  ('77777777-0000-0000-0000-0000000000a1', 'Notification Log Test Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-0000000000a1');

insert into sessions (id, cohort_id, session_number, scheduled_at) values
  ('55555555-0000-0000-0000-0000000000a1', '77777777-0000-0000-0000-0000000000a1', 1, now() + interval '1 hour');

insert into applicants (id, partner_organization_id, referral_source, status, email) values
  ('33333333-0000-0000-0000-0000000000a1', '11111111-0000-0000-0000-0000000000a1', 'partner_link', 'enrolled', 'member@example.com');

set local role service_role;

-- 2026-09-08 A5 gap-closure: session_id (20260908100000) - a
-- session-scoped notification carries a real, queryable session
-- reference now, not just a substring buried inside dedup_key.
select lives_ok(
  $$ insert into notification_log (applicant_id, notification_type, channel, status, dedup_key, session_id)
     values ('33333333-0000-0000-0000-0000000000a1', 'session_reminder_24h', 'email', 'sent', 'dedup-key-session', '55555555-0000-0000-0000-0000000000a1') $$,
  'a session-scoped notification can carry a real session_id'
);
select is(
  (select session_id from notification_log where dedup_key = 'dedup-key-session'),
  '55555555-0000-0000-0000-0000000000a1'::uuid,
  'the stored session_id matches the real session, queryable directly - not parsed out of dedup_key'
);

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
