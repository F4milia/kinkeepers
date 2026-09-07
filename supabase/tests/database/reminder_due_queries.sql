-- Coverage for P4's actual reminder-schedule gap-closure:
-- sessions_due_for_time_reminder() (24h/1h windows) and
-- applicants_due_for_missed_session_followup() (confirmed-absence,
-- next-cohort-local-morning gate). See the migration's own header for
-- why these exist and what P4 originally shipped instead.

begin;
select plan(16);

insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-00000000e101', 'Reminder Test Org', 'pgtap-reminder-org');

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-00000000e101', 'pgTAP Reminder Program', 'Test Developer', 3, 90, array['video'], array['English'], 'Lay leader', 'licensed');

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-00000000e101', 'reminder-admin@example.com'),
  ('66666666-0000-0000-0000-00000000e102', 'reminder-facilitator@example.com');
update profiles set role = 'admin' where id = '66666666-0000-0000-0000-00000000e101';
update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-00000000e102';

insert into facilitator_certifications (facilitator_id, program_id, certified_on, expires_on, certifying_body) values
  ('66666666-0000-0000-0000-00000000e102', '99999999-0000-0000-0000-00000000e101', current_date - 30, current_date + 300, 'pgTAP Certifying Body');

insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, facilitator_id) values
  ('77777777-0000-0000-0000-00000000e101', 'Reminder Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-00000000e101', '66666666-0000-0000-0000-00000000e102');

-- === sessions_due_for_time_reminder ===

insert into sessions (id, cohort_id, session_number, scheduled_at) values
  ('55555555-0000-0000-0000-00000000e101', '77777777-0000-0000-0000-00000000e101', 1, now() + interval '23 hours'),
  ('55555555-0000-0000-0000-00000000e102', '77777777-0000-0000-0000-00000000e101', 2, now() + interval '25 hours'),
  ('55555555-0000-0000-0000-00000000e103', '77777777-0000-0000-0000-00000000e101', 3, now() + interval '30 minutes'),
  ('55555555-0000-0000-0000-00000000e104', '77777777-0000-0000-0000-00000000e101', 4, now() - interval '1 hour');

insert into sessions (id, cohort_id, session_number, scheduled_at, status, cancellation_reason) values
  ('55555555-0000-0000-0000-00000000e105', '77777777-0000-0000-0000-00000000e101', 5, now() + interval '2 hours', 'cancelled', 'test');

select ok(
  '55555555-0000-0000-0000-00000000e101' in (select session_id from sessions_due_for_time_reminder(interval '24 hours')),
  'a session 23 hours out is due for a 24-hour-window reminder'
);
select ok(
  '55555555-0000-0000-0000-00000000e101' not in (select session_id from sessions_due_for_time_reminder(interval '1 hour')),
  'the same session is NOT due for a 1-hour-window reminder'
);
select ok(
  '55555555-0000-0000-0000-00000000e102' not in (select session_id from sessions_due_for_time_reminder(interval '24 hours')),
  'a session 25 hours out is outside the 24-hour window'
);
select ok(
  '55555555-0000-0000-0000-00000000e103' in (select session_id from sessions_due_for_time_reminder(interval '24 hours'))
    and '55555555-0000-0000-0000-00000000e103' in (select session_id from sessions_due_for_time_reminder(interval '1 hour')),
  'a session 30 minutes out is due for both windows'
);
select ok(
  '55555555-0000-0000-0000-00000000e104' not in (select session_id from sessions_due_for_time_reminder(interval '24 hours')),
  'a past session is never due, regardless of window'
);
select ok(
  '55555555-0000-0000-0000-00000000e105' not in (select session_id from sessions_due_for_time_reminder(interval '24 hours')),
  'a cancelled session inside the time window is excluded'
);

set local role authenticated;
select throws_ok(
  $$ select * from sessions_due_for_time_reminder(interval '24 hours') $$,
  '42501', null, 'authenticated cannot call sessions_due_for_time_reminder directly'
);
reset role;

-- === applicants_due_for_missed_session_followup ===

-- Fixed offsets, not now()-relative - the whole point is controlling
-- p_now precisely against a known session time. March 2027 predates that
-- year's US DST change (second Sunday in March), so the -05 literal
-- offset is unambiguous EST, not something DST could silently shift.
insert into sessions (id, cohort_id, session_number, scheduled_at) values
  ('55555555-0000-0000-0000-00000000e106', '77777777-0000-0000-0000-00000000e101', 6, '2027-03-09 18:30:00-05'::timestamptz);
insert into sessions (id, cohort_id, session_number, scheduled_at, status, cancellation_reason) values
  ('55555555-0000-0000-0000-00000000e107', '77777777-0000-0000-0000-00000000e101', 7, '2027-03-09 18:30:00-05'::timestamptz, 'cancelled', 'test');

insert into applicants (id, partner_organization_id, referral_source, status, cohort_id, first_name) values
  ('33333333-0000-0000-0000-00000000e101', '11111111-0000-0000-0000-00000000e101', 'partner_link', 'enrolled', '77777777-0000-0000-0000-00000000e101', 'Absent'),
  ('33333333-0000-0000-0000-00000000e102', '11111111-0000-0000-0000-00000000e101', 'partner_link', 'enrolled', '77777777-0000-0000-0000-00000000e101', 'Excused'),
  ('33333333-0000-0000-0000-00000000e103', '11111111-0000-0000-0000-00000000e101', 'partner_link', 'enrolled', '77777777-0000-0000-0000-00000000e101', 'Present'),
  ('33333333-0000-0000-0000-00000000e104', '11111111-0000-0000-0000-00000000e101', 'partner_link', 'enrolled', '77777777-0000-0000-0000-00000000e101', 'Unmarked'),
  ('33333333-0000-0000-0000-00000000e105', '11111111-0000-0000-0000-00000000e101', 'partner_link', 'enrolled', '77777777-0000-0000-0000-00000000e101', 'OptedOut'),
  ('33333333-0000-0000-0000-00000000e106', '11111111-0000-0000-0000-00000000e101', 'partner_link', 'enrolled', '77777777-0000-0000-0000-00000000e101', 'CancelledSession');

update applicants set notifications_opted_out = true where id = '33333333-0000-0000-0000-00000000e105';

insert into session_attendance (session_id, applicant_id, status, marked_by) values
  ('55555555-0000-0000-0000-00000000e106', '33333333-0000-0000-0000-00000000e101', 'absent', '66666666-0000-0000-0000-00000000e102'),
  ('55555555-0000-0000-0000-00000000e106', '33333333-0000-0000-0000-00000000e102', 'excused', '66666666-0000-0000-0000-00000000e102'),
  ('55555555-0000-0000-0000-00000000e106', '33333333-0000-0000-0000-00000000e103', 'present', '66666666-0000-0000-0000-00000000e102'),
  ('55555555-0000-0000-0000-00000000e106', '33333333-0000-0000-0000-00000000e105', 'absent', '66666666-0000-0000-0000-00000000e102'),
  ('55555555-0000-0000-0000-00000000e107', '33333333-0000-0000-0000-00000000e106', 'absent', '66666666-0000-0000-0000-00000000e102');
-- 'Unmarked' deliberately gets no session_attendance row at all.

select ok(
  '33333333-0000-0000-0000-00000000e101' in (
    select applicant_id from applicants_due_for_missed_session_followup('2027-03-10 09:00:00-05'::timestamptz)
  ),
  'a confirmed absence, checked the next morning cohort-local, is due for the follow-up'
);
select ok(
  '33333333-0000-0000-0000-00000000e102' in (
    select applicant_id from applicants_due_for_missed_session_followup('2027-03-10 09:00:00-05'::timestamptz)
  ),
  'an excused absence counts as confirmed too'
);
select ok(
  '33333333-0000-0000-0000-00000000e103' not in (
    select applicant_id from applicants_due_for_missed_session_followup('2027-03-10 09:00:00-05'::timestamptz)
  ),
  'a present mark is never due for the missed-session follow-up'
);
select ok(
  '33333333-0000-0000-0000-00000000e104' not in (
    select applicant_id from applicants_due_for_missed_session_followup('2027-03-10 09:00:00-05'::timestamptz)
  ),
  'an unmarked (no attendance row at all) applicant is excluded - confirmed, not assumed'
);
select ok(
  '33333333-0000-0000-0000-00000000e101' not in (
    select applicant_id from applicants_due_for_missed_session_followup('2027-03-09 20:00:00-05'::timestamptz)
  ),
  'the same evening as the session (not yet the next morning) is excluded'
);
select ok(
  '33333333-0000-0000-0000-00000000e101' not in (
    select applicant_id from applicants_due_for_missed_session_followup('2027-03-10 14:00:00-05'::timestamptz)
  ),
  'the right day but the wrong hour (2pm, outside 8-11am) is excluded'
);
select ok(
  '33333333-0000-0000-0000-00000000e105' not in (
    select applicant_id from applicants_due_for_missed_session_followup('2027-03-10 09:00:00-05'::timestamptz)
  ),
  'an opted-out applicant is excluded even with a confirmed absence'
);
select ok(
  '33333333-0000-0000-0000-00000000e106' not in (
    select applicant_id from applicants_due_for_missed_session_followup('2027-03-10 09:00:00-05'::timestamptz)
  ),
  'a confirmed absence on a cancelled session is excluded - the session never actually happened'
);

set local role authenticated;
select throws_ok(
  $$ select * from applicants_due_for_missed_session_followup('2027-03-10 09:00:00-05'::timestamptz) $$,
  '42501', null, 'authenticated cannot call applicants_due_for_missed_session_followup directly'
);
reset role;

select * from finish();
rollback;
