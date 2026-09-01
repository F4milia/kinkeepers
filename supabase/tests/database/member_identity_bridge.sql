-- Coverage for L5's profiles<->applicants identity bridge: claiming,
-- ambiguity, the member-scoped RLS it unlocks, and the narrow roster
-- function. Real role switches throughout, never service_role for the
-- RLS half - a test authenticated as the service role bypasses RLS
-- entirely and would pass even with the policy deleted.

begin;
select plan(16);

insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-000000000501', 'L5 Org', 'pgtap-05-org');

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-000000000501', 'pgTAP L5 Program', 'Test Developer', 3, 90, array['video'], array['English'], 'Lay leader', 'licensed');

insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id) values
  ('77777777-0000-0000-0000-000000000501', 'L5 Cohort A', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-000000000501'),
  ('77777777-0000-0000-0000-000000000502', 'L5 Cohort B', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-000000000501');

insert into sessions (id, cohort_id, session_number, scheduled_at) values
  ('55555555-0000-0000-0000-000000000601', '77777777-0000-0000-0000-000000000501', 1, now() + interval '7 days'),
  ('55555555-0000-0000-0000-000000000602', '77777777-0000-0000-0000-000000000502', 1, now() + interval '7 days');

-- member-a: single, unambiguous, enrolled match by email - the golden path.
-- member-b: unclaimed auth account with no matching applicant at all.
-- member-c: two applicant rows share the same email - ambiguous on purpose.
-- member-d: matches an applicant that's still pending_review, not enrolled -
--   must not be claimable yet.
-- member-e: a second, real member in Cohort A, used to prove the roster
--   and RLS are scoped to "this cohort", not "every applicant".
insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-000000000501', '05-member-a@example.com'),
  ('66666666-0000-0000-0000-000000000502', '05-member-b@example.com'),
  ('66666666-0000-0000-0000-000000000503', '05-member-c@example.com'),
  ('66666666-0000-0000-0000-000000000504', '05-member-d@example.com'),
  ('66666666-0000-0000-0000-000000000505', '05-member-e@example.com');

insert into applicants (id, partner_organization_id, referral_source, status, cohort_id, email, first_name, last_name) values
  ('33333333-0000-0000-0000-000000000501', '11111111-0000-0000-0000-000000000501', 'partner_link', 'enrolled', '77777777-0000-0000-0000-000000000501', '05-member-a@example.com', 'Ann', 'Alpha'),
  ('33333333-0000-0000-0000-000000000502', '11111111-0000-0000-0000-000000000501', 'partner_link', 'enrolled', '77777777-0000-0000-0000-000000000501', '05-member-c@example.com', 'Cara', 'Charlie'),
  ('33333333-0000-0000-0000-000000000503', '11111111-0000-0000-0000-000000000501', 'staff_form', 'enrolled', '77777777-0000-0000-0000-000000000501', '05-member-c@example.com', 'Cara', 'Duplicate'),
  ('33333333-0000-0000-0000-000000000504', '11111111-0000-0000-0000-000000000501', 'partner_link', 'pending_review', null, '05-member-d@example.com', 'Dana', 'Delta'),
  ('33333333-0000-0000-0000-000000000505', '11111111-0000-0000-0000-000000000501', 'partner_link', 'enrolled', '77777777-0000-0000-0000-000000000501', '05-member-e@example.com', 'Elle', 'Echo'),
  ('33333333-0000-0000-0000-000000000506', '11111111-0000-0000-0000-000000000501', 'partner_link', 'enrolled', '77777777-0000-0000-0000-000000000502', 'other-cohort@example.com', 'Otto', 'Other');

-- anon cannot call either function at all - the base grant is the deny,
-- not a policy.
set local role anon;
select throws_ok(
  $$ select claim_applicant_for_current_user() $$,
  '42501', null,
  'anon cannot call claim_applicant_for_current_user - execute not granted'
);
select throws_ok(
  $$ select * from list_cohort_roster() $$,
  '42501', null,
  'anon cannot call list_cohort_roster - execute not granted'
);
reset role;

-- member-d: real auth account, matching email, but the applicant row is
-- still pending_review with no cohort - not claimable yet.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000504", "role": "authenticated"}';
select is(
  claim_applicant_for_current_user(),
  null,
  'a pending_review applicant (not yet enrolled) is not claimed by email match'
);
reset role;

-- member-b: no applicant row matches at all.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000502", "role": "authenticated"}';
select is(
  claim_applicant_for_current_user(),
  null,
  'an account with no matching applicant at all claims nothing'
);
reset role;

-- member-c: two enrolled applicant rows share this email - ambiguous,
-- must raise rather than silently pick one.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000503", "role": "authenticated"}';
select throws_ok(
  $$ select claim_applicant_for_current_user() $$,
  'P0001', 'ambiguous_applicant_match',
  'two enrolled applicants sharing an email raises ambiguous_applicant_match instead of guessing'
);
reset role;

-- member-a: the golden path - single, unambiguous, enrolled match.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000501", "role": "authenticated"}';
select is(
  claim_applicant_for_current_user(),
  '33333333-0000-0000-0000-000000000501'::uuid,
  'a single unambiguous enrolled match is claimed and its applicant id returned'
);
-- Idempotent: calling again just returns the same id, no re-matching.
select is(
  claim_applicant_for_current_user(),
  '33333333-0000-0000-0000-000000000501'::uuid,
  'calling claim again for an already-claimed profile returns the same id, unchanged'
);
-- Now that it's claimed, the member can read their own full applicant row.
select is(
  (select count(*)::int from applicants where id = '33333333-0000-0000-0000-000000000501'),
  1,
  'a member can read their own applicant row once claimed'
);
select is(
  (select count(*)::int from applicants where id = '33333333-0000-0000-0000-000000000505'),
  0,
  'a member cannot read a cohort-mate''s full applicant row via applicants_select_own_member'
);
-- Member-scoped cohort/session access, unlocked by the claim above.
select is(
  (select count(*)::int from cohorts where id = '77777777-0000-0000-0000-000000000501'),
  1,
  'a member can read their own cohort'
);
select is(
  (select count(*)::int from cohorts where id = '77777777-0000-0000-0000-000000000502'),
  0,
  'a member cannot read a cohort they are not enrolled in'
);
select is(
  (select count(*)::int from sessions where id = '55555555-0000-0000-0000-000000000601'),
  1,
  'a member can read their own cohort''s sessions'
);
select is(
  (select count(*)::int from sessions where id = '55555555-0000-0000-0000-000000000602'),
  0,
  'a member cannot read another cohort''s sessions'
);
reset role;

-- member-e: claim then check the roster is scoped to "this cohort" and
-- exposes only first/last name, nothing else.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000505", "role": "authenticated"}';
select is(
  claim_applicant_for_current_user() is not null,
  true,
  'member-e claims their own applicant row too'
);
-- 4, not 3: Cohort A has Ann, Elle, and BOTH of member-c's duplicate
-- "Cara" rows (never resolved to a single profile, since member-c's own
-- claim above raised ambiguous_applicant_match and claimed neither) - the
-- roster lists every enrolled applicant in the cohort, not just the ones
-- who have personally signed in and claimed a profile yet.
select is(
  (select count(*)::int from list_cohort_roster()),
  4,
  'the roster returns every applicant enrolled in this member''s own cohort, claimed or not'
);
select is(
  (select count(*)::int from list_cohort_roster() where applicant_id = '33333333-0000-0000-0000-000000000506'),
  0,
  'the roster never includes an applicant from a different cohort'
);
reset role;

select * from finish();
rollback;

-- Negative-test drill, run by hand: commented out
-- "applicants_select_own_member", supabase db reset --local, re-ran this
-- file - failed tests 8, 10, and 12 (own-row read, plus both the cohorts
-- and sessions member policies, which subquery applicants themselves and
-- so cascade when the member can no longer see their own applicant row).
-- Restored, reset --local, all 16 passed again. Repeated for
-- "cohorts_select_own_member" alone - only test 10 failed. Repeated for
-- "sessions_select_own_member" alone - only test 12 failed. Each restored
-- and reset --local back to all 16 passing before moving to the next.
--
-- Also tried commenting out each function's own `grant execute ... to
-- authenticated` line specifically - neither failed, because Supabase's
-- default ACL already grants EXECUTE on every newly created function to
-- authenticated (and to anon/public) at creation time (same footgun
-- CLAUDE.md's Learned Constraints already names for tables) - those grant
-- lines are cosmetic-only. The real enforcement is each function's
-- `revoke execute ... from public, anon` line: commenting either one out
-- individually (restored and reset --local between each) made the
-- corresponding anon throws_ok assertion (test 1 for
-- claim_applicant_for_current_user, test 2 for list_cohort_roster) fail
-- exactly as expected - claim's raised "not_authenticated" instead of a
-- permission error, and the roster's returned zero rows with no
-- exception at all, both proving anon really could call through without
-- the revoke.
