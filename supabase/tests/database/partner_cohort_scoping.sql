-- Coverage for A5's partner_staff read-scoping on cohorts/sessions: "a
-- partner organization sees cohorts containing caregivers they
-- referred," and nothing else. Same methodology as every other suite
-- here: real role switches, never assumed.

begin;
select plan(8);

insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-00000000a501', 'A5 Org A', 'pgtap-a5-org-a'),
  ('11111111-0000-0000-0000-00000000a502', 'A5 Org B', 'pgtap-a5-org-b');

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-00000000a501', 'a5-admin@example.com'),
  ('66666666-0000-0000-0000-00000000a502', 'a5-partner-staff-a@example.com'),
  ('66666666-0000-0000-0000-00000000a503', 'a5-member@example.com');
update profiles set role = 'admin' where id = '66666666-0000-0000-0000-00000000a501';
update profiles set role = 'partner_staff', partner_organization_id = '11111111-0000-0000-0000-00000000a501'
  where id = '66666666-0000-0000-0000-00000000a502';

insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status) values
  ('99999999-0000-0000-0000-00000000a501', 'pgTAP A5 Program', 'Test Developer', 3, 90, array['video'], array['English'], 'Lay leader', 'licensed');

-- Cohort A has an Org A referral enrolled in it - Org A's partner_staff
-- should see this one.
insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, program_id)
values
  ('77777777-0000-0000-0000-00000000a501', 'Cohort With Org A Referral', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-00000000a501'),
  ('77777777-0000-0000-0000-00000000a502', 'Cohort With Org B Referral Only', 'x', 8, 'weekly', 2, '18:30', 'America/New_York', '99999999-0000-0000-0000-00000000a501');

insert into sessions (id, cohort_id, session_number, scheduled_at) values
  ('55555555-0000-0000-0000-00000000a501', '77777777-0000-0000-0000-00000000a501', 1, now() + interval '7 days'),
  ('55555555-0000-0000-0000-00000000a502', '77777777-0000-0000-0000-00000000a502', 1, now() + interval '7 days');

insert into applicants (id, partner_organization_id, referral_source, status, cohort_id) values
  ('33333333-0000-0000-0000-00000000a501', '11111111-0000-0000-0000-00000000a501', 'partner_link', 'enrolled', '77777777-0000-0000-0000-00000000a501'),
  ('33333333-0000-0000-0000-00000000a502', '11111111-0000-0000-0000-00000000a502', 'partner_link', 'enrolled', '77777777-0000-0000-0000-00000000a502');

-- admin: unaffected baseline (both cohorts/sessions visible either way)
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-00000000a501", "role": "authenticated"}';
select is(
  (select count(*)::int from cohorts where id in ('77777777-0000-0000-0000-00000000a501', '77777777-0000-0000-0000-00000000a502')),
  2,
  'admin still sees both cohorts - the new policy only widens access, never narrows it'
);
reset role;

-- Org A partner_staff: sees the cohort/session with their own referral,
-- not the one with only Org B's.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-00000000a502", "role": "authenticated"}';
select is(
  (select count(*)::int from cohorts where id = '77777777-0000-0000-0000-00000000a501'),
  1,
  'Org A partner_staff can read the cohort containing their own referral'
);
select is(
  (select count(*)::int from cohorts where id = '77777777-0000-0000-0000-00000000a502'),
  0,
  'Org A partner_staff cannot read the cohort containing only Org B''s referral'
);
select is(
  (select count(*)::int from sessions where id = '55555555-0000-0000-0000-00000000a501'),
  1,
  'Org A partner_staff can read the session under their own referral''s cohort'
);
select is(
  (select count(*)::int from sessions where id = '55555555-0000-0000-0000-00000000a502'),
  0,
  'Org A partner_staff cannot read the session under Org B''s cohort'
);
reset role;

-- A plain member (no partner_organization_id) sees neither.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-00000000a503", "role": "authenticated"}';
select is(
  (select count(*)::int from cohorts where id in ('77777777-0000-0000-0000-00000000a501', '77777777-0000-0000-0000-00000000a502')),
  0,
  'a member with no partner_organization_id sees neither cohort'
);
select is(
  (select count(*)::int from sessions where id in ('55555555-0000-0000-0000-00000000a501', '55555555-0000-0000-0000-00000000a502')),
  0,
  'a member with no partner_organization_id sees neither session'
);
reset role;

set local role anon;
select throws_ok(
  $$ select count(*) from cohorts where id = '77777777-0000-0000-0000-00000000a501' $$,
  '42501', null,
  'anon still cannot read cohorts at all - the grant-level deny is untouched'
);
reset role;

select * from finish();
rollback;

-- Negative-test drill, run by hand:
--   commented out "cohorts_select_own_partner_referrals" -> supabase db
--   reset --local, re-ran this file: "Org A partner_staff can read the
--   cohort containing their own referral" failed ("have: 0, want: 1") -
--   confirming the new policy, not the existing admin/facilitator ones,
--   is what makes it possible. Restored, reset, all 8 passed again.
--   Repeated for "sessions_select_own_partner_referrals": commented it
--   out, reset, "Org A partner_staff can read the session under their
--   own referral's cohort" failed the same way ("have: 0, want: 1").
--   Restored, reset --local, all 8 passed again.
