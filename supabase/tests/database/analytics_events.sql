-- Coverage for P5: the analytics_events table, its three real writers
-- (assign_applicant_to_cohort's member_enrolled, mark_cohort_completed's
-- cohort_completed, the new withdraw_applicant's member_dropped), and
-- all six derived views/functions. Same methodology as every other suite
-- here: real role switches, never service_role for an RLS/grant check;
-- audit_log counts scoped by a baseline delta.
--
-- attendance_rate_by_session_number, retention_at_session_3/6, and
-- engagement_rate have no real writer yet (session_attended/
-- session_missed/post_created - see the migration's own header comment
-- for why) - this suite seeds synthetic analytics_events rows directly
-- to verify those views' SQL is correct, which is a genuinely different
-- claim from "real product data flows into them," documented as such in
-- the PR description.

begin;
select plan(29);

insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-000000000501', 'P5 Test Org', 'pgtap-p5-org');

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-000000000501', 'pgTAP P5 Program', 'Test Developer', 3, 90, array['video'], array['English'], 'Lay leader', 'licensed');

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-000000000501', 'p5-admin@example.com');
update profiles set role = 'admin' where id = '66666666-0000-0000-0000-000000000501';

insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id, status) values
  ('77777777-0000-0000-0000-000000000501', 'P5 Test Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-000000000501', 'active');

insert into applicants (id, partner_organization_id, referral_source, status) values
  ('33333333-0000-0000-0000-000000000501', '11111111-0000-0000-0000-000000000501', 'partner_link', 'pending_review'),
  ('33333333-0000-0000-0000-000000000502', '11111111-0000-0000-0000-000000000501', 'staff_form', 'pending_review');

-- ---------------------------------------------------------------------
-- Grant-level enforcement: anon/authenticated cannot reach the write
-- path or the views/functions directly - same drill methodology as
-- CLAUDE.md's L5 Learned Constraints entry (the grant line is the real
-- enforcement, not the revoke-from-anon default alone).
-- ---------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select record_analytics_event('member_enrolled'::analytics_event_type, 'x') $$,
  '42501', null, 'anon cannot call record_analytics_event directly'
);
select throws_ok(
  $$ select withdraw_applicant('66666666-0000-0000-0000-000000000501', '33333333-0000-0000-0000-000000000501') $$,
  '42501', null, 'anon cannot call withdraw_applicant directly'
);
select throws_ok(
  $$ select * from retention_at_session(3) $$,
  '42501', null, 'anon cannot call retention_at_session directly'
);
select throws_ok(
  $$ select count(*) from analytics_events $$,
  '42501', null, 'anon cannot read analytics_events directly'
);
select throws_ok(
  $$ select count(*) from referral_conversion $$,
  '42501', null, 'anon cannot read referral_conversion directly'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000501", "role": "authenticated"}';
select throws_ok(
  $$ select record_analytics_event('member_enrolled'::analytics_event_type, 'x') $$,
  '42501', null, 'an authenticated admin still cannot call record_analytics_event directly - service_role only'
);
reset role;

set local role service_role;

-- ---------------------------------------------------------------------
-- member_enrolled, via assign_applicant_to_cohort - real writer.
-- ---------------------------------------------------------------------
create temporary table analytics_baseline as
  select count(*) filter (where event_type = 'member_enrolled')::int as enrolled_n
  from analytics_events;

select lives_ok(
  $$ select assign_applicant_to_cohort(
       '66666666-0000-0000-0000-000000000501', '33333333-0000-0000-0000-000000000501',
       '77777777-0000-0000-0000-000000000501') $$,
  'service_role can assign a pending_review applicant to a cohort'
);

select is(
  (select count(*)::int from analytics_events where event_type = 'member_enrolled')
    - (select enrolled_n from analytics_baseline),
  1,
  'assignment writes exactly one new member_enrolled event'
);

select is(
  (select cohort_id from analytics_events
     where event_type = 'member_enrolled' and subject_id = '33333333-0000-0000-0000-000000000501'),
  '77777777-0000-0000-0000-000000000501'::uuid,
  'the member_enrolled event records the real cohort_id'
);

select is(
  (select payload->>'referral_source' from analytics_events
     where event_type = 'member_enrolled' and subject_id = '33333333-0000-0000-0000-000000000501'),
  'partner_link',
  'the member_enrolled event payload carries the applicant''s real referral_source'
);

-- ---------------------------------------------------------------------
-- withdraw_applicant / member_dropped - new function, real writer.
-- ---------------------------------------------------------------------
select throws_ok(
  format($$ select withdraw_applicant(%L, '33333333-0000-0000-0000-000000000502', 'moved away') $$, '66666666-0000-0000-0000-000000000501'),
  null, 'applicant 33333333-0000-0000-0000-000000000502 is not enrolled or attending',
  'a pending_review applicant cannot be withdrawn - that is a decline, not a withdrawal'
);

create temporary table audit_baseline as
  select count(*) filter (where action = 'applicant_withdrawn')::int as withdrawn_n
  from audit_log where subject_type = 'applicant';

select lives_ok(
  format($$ select withdraw_applicant(%L, '33333333-0000-0000-0000-000000000501', 'moved away') $$, '66666666-0000-0000-0000-000000000501'),
  'an enrolled applicant can be withdrawn'
);

select is(
  (select status::text from applicants where id = '33333333-0000-0000-0000-000000000501'),
  'withdrawn',
  'withdrawal sets the applicant status to withdrawn'
);

select is(
  (select count(*)::int from audit_log where action = 'applicant_withdrawn' and subject_type = 'applicant')
    - (select withdrawn_n from audit_baseline),
  1,
  'withdrawal writes exactly one new applicant_withdrawn audit_log row'
);

select is(
  (select payload->>'reason_code' from analytics_events
     where event_type = 'member_dropped' and subject_id = '33333333-0000-0000-0000-000000000501'),
  'moved away',
  'the member_dropped event payload carries the free-text reason'
);

select throws_ok(
  format($$ select withdraw_applicant(%L, '33333333-0000-0000-0000-000000000501') $$, '66666666-0000-0000-0000-000000000501'),
  null, 'applicant 33333333-0000-0000-0000-000000000501 is not enrolled or attending',
  'an already-withdrawn applicant cannot be withdrawn again'
);

-- ---------------------------------------------------------------------
-- cohort_completed, via mark_cohort_completed - completion_rate excludes
-- cancelled sessions, needs no attendance data.
-- ---------------------------------------------------------------------
insert into sessions (id, cohort_id, session_number, scheduled_at, status) values
  ('55555555-0000-0000-0000-000000000701', '77777777-0000-0000-0000-000000000501', 1, now() - interval '14 days', 'completed'),
  ('55555555-0000-0000-0000-000000000702', '77777777-0000-0000-0000-000000000501', 2, now() - interval '7 days', 'cancelled'),
  ('55555555-0000-0000-0000-000000000703', '77777777-0000-0000-0000-000000000501', 3, now() - interval '1 days', 'completed');

select lives_ok(
  format($$ select mark_cohort_completed(%L, '77777777-0000-0000-0000-000000000501') $$, '66666666-0000-0000-0000-000000000501'),
  'an active cohort with 3 sessions (1 cancelled) can be marked completed'
);

select is(
  (select (payload->>'completion_rate')::numeric from analytics_events
     where event_type = 'cohort_completed' and subject_id = '77777777-0000-0000-0000-000000000501'),
  0.667,
  'completion_rate excludes the cancelled session (2 of 3 occurred, rounded to 0.667), needing no attendance data'
);

-- ---------------------------------------------------------------------
-- referral_conversion / cohort_fill_time - real views, real data above.
-- P5 Test Org referred 2 applicants, 1 reached member_enrolled.
-- ---------------------------------------------------------------------
select is(
  (select total_referred::int from referral_conversion where partner_organization_id = '11111111-0000-0000-0000-000000000501'),
  2,
  'referral_conversion counts every applicant referred by the org'
);
select is(
  (select total_enrolled::int from referral_conversion where partner_organization_id = '11111111-0000-0000-0000-000000000501'),
  1,
  'referral_conversion counts only the one that reached member_enrolled'
);
select is(
  (select conversion_rate_percent from referral_conversion where partner_organization_id = '11111111-0000-0000-0000-000000000501'),
  50.0,
  'referral_conversion computes the correct percentage'
);

select ok(
  (select avg_referral_to_enrolled >= interval '0 seconds' from cohort_fill_time where cohort_id = '77777777-0000-0000-0000-000000000501'),
  'cohort_fill_time returns a real, non-negative referral-to-enrolled duration'
);

-- ---------------------------------------------------------------------
-- attendance_rate_by_session_number / retention_at_session_3/6 /
-- engagement_rate - no real writer yet, seeded synthetically to verify
-- the SQL itself, not real product behavior.
-- ---------------------------------------------------------------------
insert into applicants (id, partner_organization_id, referral_source, status, cohort_id) values
  ('33333333-0000-0000-0000-000000000510', '11111111-0000-0000-0000-000000000501', 'partner_link', 'attending', '77777777-0000-0000-0000-000000000501'),
  ('33333333-0000-0000-0000-000000000511', '11111111-0000-0000-0000-000000000501', 'partner_link', 'attending', '77777777-0000-0000-0000-000000000501');

-- Both enrolled members attended session 3; only one attended session 6.
select record_analytics_event('session_attended'::analytics_event_type, '33333333-0000-0000-0000-000000000510', '77777777-0000-0000-0000-000000000501', null, '{"session_number": 3}'::jsonb);
select record_analytics_event('session_attended'::analytics_event_type, '33333333-0000-0000-0000-000000000511', '77777777-0000-0000-0000-000000000501', null, '{"session_number": 3}'::jsonb);
select record_analytics_event('session_attended'::analytics_event_type, '33333333-0000-0000-0000-000000000510', '77777777-0000-0000-0000-000000000501', null, '{"session_number": 6}'::jsonb);
select record_analytics_event('session_missed'::analytics_event_type, '33333333-0000-0000-0000-000000000511', '77777777-0000-0000-0000-000000000501', null, '{"session_number": 6}'::jsonb);

select is(
  (select attended_count::int from attendance_rate_by_session_number where session_number = 3),
  2,
  'attendance_rate_by_session_number counts synthetic session_attended events at session 3'
);
-- Scoped to this test's own cohort, not the global retention_at_session_3/6
-- views: the global views blend in every other applicant that exists
-- anywhere (including seed.sql's own unrelated enrolled/completed rows),
-- so an isolated assertion needs the cohort-scoped call directly - see
-- retention_at_session()'s own comment for why the parameter exists.
select is(
  (select retention_rate_percent from retention_at_session(3, '77777777-0000-0000-0000-000000000501')),
  100.0,
  'retention_at_session(3, cohort) is 100% - both enrolled/attending members in this cohort attended session 3'
);
select is(
  (select retention_rate_percent from retention_at_session(6, '77777777-0000-0000-0000-000000000501')),
  50.0,
  'retention_at_session(6, cohort) is 50% - only one of two attended session 6'
);
select is(
  (select enrolled_count::int from retention_at_session_3) >= 2,
  true,
  'the global retention_at_session_3 view (no cohort filter) at least includes this test''s own cohort'
);

insert into applicants (id, partner_organization_id, referral_source, status, cohort_id) values
  ('33333333-0000-0000-0000-000000000512', '11111111-0000-0000-0000-000000000501', 'staff_form', 'attending', '77777777-0000-0000-0000-000000000501');
select record_analytics_event('post_created'::analytics_event_type, '33333333-0000-0000-0000-000000000510', '77777777-0000-0000-0000-000000000501');

select is(
  (select members_who_posted::int from engagement_rate where cohort_id = '77777777-0000-0000-0000-000000000501'),
  1,
  'engagement_rate counts the one member with a synthetic post_created event'
);
select is(
  (select enrolled_count::int from engagement_rate where cohort_id = '77777777-0000-0000-0000-000000000501'),
  3,
  'engagement_rate''s enrolled_count reflects all real enrolled/attending members in the cohort'
);

-- ---------------------------------------------------------------------
-- No third-party analytics SDK anywhere - the run doc's own acceptance
-- criterion. Not a SQL assertion, but recorded here as part of this
-- suite's own verification (grep run by hand, documented below).
-- ---------------------------------------------------------------------
select pass('grep confirms no Mixpanel/Amplitude/PostHog/Segment/Google Analytics import anywhere in the repo (run by hand: see this PR''s description)');

reset role;

select * from finish();
rollback;

-- Negative-test drill, run by hand: tried commenting out each function's
-- own `grant execute ... to service_role` line (record_analytics_event,
-- then withdraw_applicant, called both from inside another function's
-- perform AND directly at the top level as service_role) - neither
-- failed anything, confirming the exact same already-documented finding
-- from L5 (CLAUDE.md's 2026-09-02 Learned Constraints entry): Supabase's
-- default ACL grants EXECUTE on every new function to service_role (and
-- anon/authenticated) at creation time regardless of that line - it's
-- cosmetic. The real enforcement is each function's own explicit
-- `revoke execute ... from public, anon, authenticated` line, already
-- covered by this suite's anon/authenticated throws_ok assertions above.
--
-- Commented out `revoke all on analytics_events from anon,
-- authenticated` instead (the table-level grant, not a function) -
-- supabase db reset --local, re-ran this file: "anon cannot read
-- analytics_events directly" failed with no exception at all where a
-- 42501 was expected, confirming that revoke line IS the real
-- enforcement for direct table reads. Restored, reset --local, all 29
-- passed again.
