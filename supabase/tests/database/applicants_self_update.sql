-- Coverage for 20260903120000: a member updating their own applicant
-- row's contact fields (name, email, phone, time zone, notification
-- channel) - column-scoped grant + row-scoped RLS, no SECURITY DEFINER
-- function, same pattern as member_consents_insert_own. Real role
-- switches throughout - never service_role for the RLS half.

begin;
select plan(8);

insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-000000000701', 'Self-Update Org', 'pgtap-07-org');

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-000000000701', 'pgTAP Self-Update Program', 'Test Developer', 3, 90, array['video'], array['English'], 'Lay leader', 'licensed');

insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id) values
  ('77777777-0000-0000-0000-000000000701', 'Self-Update Cohort', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-000000000701');

-- member-a: owns applicant-701, used for the golden path and the
-- cross-row negative check. member-b: owns applicant-702, a bystander
-- whose row must stay untouched by member-a's writes.
insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-000000000701', '07-member-a@example.com'),
  ('66666666-0000-0000-0000-000000000702', '07-member-b@example.com');

insert into applicants (id, partner_organization_id, referral_source, status, cohort_id, profile_id, email, phone, first_name, last_name, time_zone, preferred_contact_channel) values
  ('33333333-0000-0000-0000-000000000701', '11111111-0000-0000-0000-000000000701', 'partner_link', 'enrolled', '77777777-0000-0000-0000-000000000701', '66666666-0000-0000-0000-000000000701', '07-member-a@example.com', '+15550170001', 'Ann', 'Alpha', 'America/New_York', 'both'),
  ('33333333-0000-0000-0000-000000000702', '11111111-0000-0000-0000-000000000701', 'partner_link', 'enrolled', '77777777-0000-0000-0000-000000000701', '66666666-0000-0000-0000-000000000702', '07-member-b@example.com', '+15550170002', 'Beth', 'Bravo', 'America/New_York', 'both');

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000701", "role": "authenticated"}';

-- Golden path: a member updates their own name, contact email/phone,
-- time zone, and notification channel in one statement.
select lives_ok(
  $$ update applicants set first_name = 'Annie', email = '07-member-a-new@example.com', phone = '+15550170099', time_zone = 'America/Chicago', preferred_contact_channel = 'sms' where id = '33333333-0000-0000-0000-000000000701' $$,
  'a member can update their own name, contact info, time zone, and notification channel'
);
select is(
  (select preferred_contact_channel::text from applicants where id = '33333333-0000-0000-0000-000000000701'),
  'sms',
  'the notification channel change is persisted'
);
select is(
  (select email from applicants where id = '33333333-0000-0000-0000-000000000701'),
  '07-member-a-new@example.com',
  'the contact email change is persisted'
);

-- Column scope: status/cohort_id are not in the grant's column list, so
-- an update that touches either is rejected outright, before RLS even
-- evaluates the row.
select throws_ok(
  $$ update applicants set status = 'declined' where id = '33333333-0000-0000-0000-000000000701' $$,
  '42501', null,
  'a member cannot change their own status - the column grant excludes it'
);
select throws_ok(
  $$ update applicants set cohort_id = null where id = '33333333-0000-0000-0000-000000000701' $$,
  '42501', null,
  'a member cannot change their own cohort_id - the column grant excludes it'
);

-- Row scope: an update naming a cohort-mate's row by id matches zero
-- rows under RLS (not an error - the same silent-no-match shape a
-- WHERE clause that excludes every row already has) and leaves that
-- row untouched.
select results_eq(
  $$ update applicants set first_name = 'Hijacked' where id = '33333333-0000-0000-0000-000000000702' returning id $$,
  $$ select null::uuid where false $$,
  'updating a row the caller does not own matches zero rows under RLS'
);
reset role;

-- Confirmed as service_role, not as member-a: member-a's own RLS can't
-- see member-b's row at all (applicants_select_own_member), so this read
-- needs a role that bypasses RLS to independently verify the row's
-- actual content after the blocked update attempt above.
set local role service_role;
select is(
  (select first_name from applicants where id = '33333333-0000-0000-0000-000000000702'),
  'Beth',
  'a cohort-mate''s row is confirmed untouched by the attempted update'
);
reset role;

-- anon cannot write at all - no grant, no policy needed to prove it.
set local role anon;
select throws_ok(
  $$ update applicants set first_name = 'Nope' where id = '33333333-0000-0000-0000-000000000701' $$,
  '42501', null,
  'anon cannot update applicants at all - no update grant exists for anon'
);
reset role;

select * from finish();
rollback;

-- Negative-test drill, actually run (not hypothetical): commented out
-- "applicants_update_own_member", `supabase db reset --local`, re-ran
-- this file - test 1 (lives_ok) still passed with no exception (with no
-- UPDATE policy at all, RLS's USING defaults to denying every row for
-- that command, so the statement itself succeeds but matches zero rows,
-- same as a WHERE clause that excludes everything), but tests 2 and 3
-- failed - "have: both, want: sms" / the email unchanged - proving
-- nothing was actually written. Restored, reset --local, all 8 passed
-- again.
--
-- Also tried commenting out the `grant update (...) on applicants to
-- authenticated` line alone (policy restored, reset --local) - this time
-- test 1 DIED outright with a real 42501 permission-denied error
-- (Postgres's own hint: "GRANT UPDATE ON public.applicants TO
-- authenticated"), which also broke the test plan count (5 tests ran
-- against a plan of 8) - a materially different failure mode than the
-- policy drill above, confirming this is a real, load-bearing grant, not
-- the cosmetic EXECUTE-grant footgun CLAUDE.md's Learned Constraints
-- found for new functions. The difference isn't that table privileges
-- are exempt from the permissive default ACL (they aren't - a brand new
-- table gets full UPDATE for authenticated automatically, same footgun);
-- it's that 20260827203458_referral_intake_schema.sql already revoked
-- all of it from authenticated on this specific table, so this
-- migration's grant is genuinely what re-enables writes, not a no-op
-- restating a default that was never removed. Restored, reset --local,
-- all 8 passing again.
