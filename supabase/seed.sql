-- Staging seed data.
--
-- Per the X1 amendment, this starts minimal and grows incrementally: each
-- session that introduces a table (P1's profiles, P2's partner
-- organizations, A3's cohorts, ...) extends this file in its own PR, once
-- that table exists. Do not pre-seed rows for tables that don't exist yet.
--
-- `supabase db reset` truncates and re-runs this file from scratch every
-- time, so plain INSERTs here are safe -- there is no "already exists"
-- state to guard against.

-- partner_organizations (P2) - two orgs, enough to exercise referral-link
-- scoping and RLS isolation without inventing a large fake partner roster.
insert into partner_organizations (name, referral_link_slug) values
  ('Riverside Health Network', 'riverside-health'),
  ('Lakeside Family Medicine', 'lakeside-family');

-- programs (X2) - the four group/online/lay-leader-deliverable BPC
-- programs named in the run doc. developer names verified against public
-- sources (see the migration's own comment) since bpc.caregiver.org
-- itself isn't reachable from here - reconcile against BPC directly if
-- these ever need to be authoritative for a license negotiation.
--
-- No program is seeded as 'licensed'. Nothing in either companion doc
-- confirms real licensing terms for any of these four - Tele-Savvy's are
-- explicitly "NOT settled" (kinkeepers-frontend-build.md Part 6: "do not
-- print this program name on anything external until terms are signed"),
-- Savvy Caregiver's pricing came back prohibitive, and Powerful
-- Tools/Stress-Busting are named only as fallback candidates. Tele-Savvy
-- is seeded in_negotiation (it's the one actually being pursued); the
-- other three are not_licensed. Ivan updates these once terms are real -
-- until then this seed makes zero programs selectable for a cohort,
-- which is the accurate state, not a bug.
insert into programs (id, name, developer, session_count, session_duration_minutes, delivery_formats, languages, facilitator_qualification, license_status, notes) values
  (
    '77777777-0000-0000-0000-000000000001', 'Tele-Savvy',
    'Hepburn, Lewis, Wexler Sherman, Tornatore, Dolloff',
    6, 90, array['video'], array['English', 'Spanish', 'Chinese'],
    'Lay leader, professional, or paraprofessional', 'in_negotiation',
    'Commercial terms not settled - same developer team as Savvy Caregiver. Sessions run 90-120 min; 90 stored as the base, actual length varies by session content. Do not display this program name externally until terms are signed.'
  ),
  (
    '77777777-0000-0000-0000-000000000002', 'Savvy Caregiver',
    'Kenneth Hepburn (University of Minnesota)',
    6, 90, array['video', 'in_person'], array['English'],
    'Lay leader', 'not_licensed',
    'Pricing came back prohibitive when explored. Sessions run 90-120 min; 90 stored as the base.'
  ),
  (
    '77777777-0000-0000-0000-000000000003', 'Powerful Tools for Caregivers',
    'Legacy Caregiver Services, now housed at Iowa State University Extension and Outreach',
    6, 90, array['video', 'in_person'], array['English'],
    'Lay leader', 'not_licensed',
    'Fallback candidate, not yet pursued. Sessions run 90-150 min; 90 stored as the base.'
  ),
  (
    '77777777-0000-0000-0000-000000000004', 'Stress-Busting Program',
    'Sharon Lewis, Denise Miner-Williams (UT Health Science Center San Antonio)',
    9, 90, array['video', 'in_person'], array['English', 'Spanish'],
    'Lay leader only', 'not_licensed',
    'Fallback candidate, not yet pursued. Lay-leader delivery is exclusive for this program, unlike the other three.'
  );

-- program_sessions - numbered slots only, per program's session_count.
-- Titles/descriptions stay null: licensed curriculum content may be
-- protected, and none of these four programs has confirmed licensing yet.
insert into program_sessions (program_id, session_number)
select p.id, gs.session_number
from programs p
cross join lateral generate_series(1, p.session_count) as gs(session_number);

-- cohorts (A2 stub) - two open cohorts so the assignment picker
-- (lib/admin/assignment.ts) has real options to show composition and
-- remaining capacity against. A3 (Wave 4) owns real cohort creation and
-- will extend/replace this - kept to exactly the fields the A2 screens
-- read, same reasoning as the migration's own comment.
-- cadence is a real enum as of A3's cohort_cadence_enum migration
-- ('weekly'/'biweekly') - both these sample cohorts meet weekly, just on
-- different days (meeting_day_of_week/meeting_time already carry that).
insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone) values
  (
    '99999999-0000-0000-0000-000000000001', 'Spouses, Early Stage — Tuesday Evenings',
    'Spouses caring for a partner in early-stage dementia',
    12, 'weekly', 2, '18:30', 'America/New_York'
  ),
  (
    '99999999-0000-0000-0000-000000000002', 'Adult Children, Middle Stage — Thursday Mornings',
    'Adult children caring for a parent in middle-stage dementia',
    10, 'weekly', 4, '10:00', 'America/Chicago'
  );

-- applicants (P2/A2) - enough to exercise both admin/applicants tabs
-- (pending review, declined) and the assignment picker's composition
-- view. Two applicants share relationship+stage so
-- applicant_waitlist_summary has a real count above 1 to show, not just
-- singletons. Inserted with status 'pending_review' directly so the
-- pending_review_since stamping trigger fires the same way a real
-- intake-to-review transition would.
insert into applicants (id, partner_organization_id, referral_source, first_name, last_name, email, phone, time_zone, relationship, care_recipient_stage, preferred_contact_channel, status) values
  (
    '88888888-0000-0000-0000-000000000001',
    (select id from partner_organizations where name = 'Riverside Health Network'),
    'partner_link', 'Miriam', 'Castillo', 'miriam.castillo@example.com', '+15125550101',
    'America/Chicago', 'Spouse', 'early', 'both', 'pending_review'
  ),
  (
    '88888888-0000-0000-0000-000000000002',
    (select id from partner_organizations where name = 'Riverside Health Network'),
    'staff_form', 'Priya', 'Desai', 'priya.desai@example.com', '+15125550102',
    'America/Chicago', 'Spouse', 'early', 'email', 'pending_review'
  ),
  (
    '88888888-0000-0000-0000-000000000003',
    (select id from partner_organizations where name = 'Lakeside Family Medicine'),
    'staff_form', 'Oscar', 'Bennett', 'oscar.bennett@example.com', '+13125550103',
    'America/Chicago', 'Adult child', 'middle', 'sms', 'pending_review'
  ),
  (
    '88888888-0000-0000-0000-000000000004',
    (select id from partner_organizations where name = 'Lakeside Family Medicine'),
    'staff_form', 'Frank', 'Delgado', 'frank.delgado@example.com', '+13125550104',
    'America/Chicago', 'Sibling', 'late', 'both', 'declined'
  );

update applicants set decline_reason = 'unresponsive' where id = '88888888-0000-0000-0000-000000000004';

-- L5: a session #1 already scheduled, so /status/[applicantId]'s
-- "assigned, before session one" state has something real to render
-- against. No program_id: enforce_cohort_program_and_facilitator()
-- (X2) rejects any non-null program_id whose license_status isn't
-- 'licensed', and this seed deliberately licenses none yet ("makes zero
-- programs selectable... accurate state, not a bug") - a null program_id
-- here is the same honesty, not a shortcut. Own cohort, not one of the
-- two above, so this never perturbs A2/A3's existing composition-based
-- tests.
insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, delivery_format, status) values
  (
    '99999999-0000-0000-0000-000000000501', 'L5 Demo Cohort',
    'Demo cohort for the applicant status page''s assigned state',
    10, 'weekly', 2, '18:30', 'America/New_York',
    'video', 'active'
  );

insert into sessions (id, cohort_id, session_number, scheduled_at, video_join_url, video_dial_in_number, video_dial_in_pin) values
  (
    '55555555-0000-0000-0000-000000000501', '99999999-0000-0000-0000-000000000501', 1,
    now() + interval '7 days', 'https://example.com/l5-demo-join', '1-800-555-0199', '123456'
  );

-- L5: the applicant-facing status page's other two real states -
-- "enrolled, before session one" and "completed" - seeded with fixed ids
-- so e2e/smoke.spec.ts can visit them directly. The "waitlisted" (pending
-- review, no matching cohort) state from the old fixture-driven UI is not
-- seeded here: hasMatchingCohort is hardcoded true in lib/data.ts
-- (confirmed with Ferenz - no real matching signal exists), so every
-- pending_review applicant now renders "waiting for review" and that
-- second branch is unreachable with real data.
insert into applicants (id, partner_organization_id, referral_source, first_name, last_name, email, phone, time_zone, relationship, care_recipient_stage, preferred_contact_channel, status, cohort_id) values
  (
    '88888888-0000-0000-0000-000000000502',
    (select id from partner_organizations where name = 'Riverside Health Network'),
    'partner_link', 'Sam', 'Ellison', 'sam.ellison@example.com', '+15125550199',
    'America/New_York', 'Spouse', 'early', 'email', 'enrolled', '99999999-0000-0000-0000-000000000501'
  ),
  (
    '88888888-0000-0000-0000-000000000503',
    (select id from partner_organizations where name = 'Riverside Health Network'),
    'partner_link', 'Terry', 'Whitfield', 'terry.whitfield@example.com', '+15125550198',
    'America/New_York', 'Adult child', 'late', 'email', 'completed', '99999999-0000-0000-0000-000000000501'
  );

-- Backdated so the admin queue's oldest-first sort and "N days waiting"
-- copy have real variation to show - the stamping trigger sets these to
-- now() on insert above, which would otherwise make every seeded row
-- read "0 days waiting" and the sort order invisible.
update applicants set pending_review_since = now() - interval '12 days' where id = '88888888-0000-0000-0000-000000000001';
update applicants set pending_review_since = now() - interval '4 days' where id = '88888888-0000-0000-0000-000000000003';
update applicants set pending_review_since = now() - interval '1 day' where id = '88888888-0000-0000-0000-000000000002';

-- consent_documents (P6) - version 1 of all four, clearly marked as
-- placeholder text pending Ivan's attorney-reviewed versions. Body text
-- is deliberately generic/obviously-a-placeholder, not something that
-- could be mistaken for real legal text if it ever leaked into a screen
-- before real text lands.
insert into consent_documents (document_type, version, body, is_placeholder) values
  ('terms_of_service', 1, '[PLACEHOLDER - Terms of Service v1. Attorney-reviewed text pending. Do not treat as real.]', true),
  ('privacy_policy', 1, '[PLACEHOLDER - Privacy Policy v1. Attorney-reviewed text pending. Do not treat as real.]', true),
  ('participant_agreement', 1, '[PLACEHOLDER - Participant Agreement v1. Attorney-reviewed text pending. Do not treat as real.]', true),
  ('group_confidentiality', 1, '[PLACEHOLDER - Group Confidentiality Agreement v1. Attorney-reviewed text pending. Do not treat as real. Members agree not to share what others say outside the group.]', true);

-- F2 QA fixture: a real, sign-in-able facilitator account, so a human
-- tester can actually reach /facilitator/certifications instead of the
-- surface having no seeded way to sign in at all - every prior facilitator
-- reference in this file (F1's own screens) had this same gap, since
-- accounts were previously assumed to only ever come from real sign-in.
-- A plain application-level INSERT can't create a working GoTrue account
-- (no admin API access from inside seed.sql, which is pure SQL run via
-- `supabase db reset`) - this inserts directly into auth.users/
-- auth.identities instead, matching the columns a real signInWithOtp +
-- magic-link redemption needs. Verified end-to-end before adding this:
-- a real OTP email arrived in Mailpit and redeeming its link returned a
-- genuine access_token for this exact row, not just an id that satisfies
-- a foreign key the way pgTAP's own auth.users stub rows do.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
  recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '66666666-0000-0000-0000-0000000f2601',
  'authenticated', 'authenticated', 'renata.solis@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at) values (
  gen_random_uuid(), '66666666-0000-0000-0000-0000000f2601', '66666666-0000-0000-0000-0000000f2601',
  '{"sub":"66666666-0000-0000-0000-0000000f2601","email":"renata.solis@example.com","email_verified":true,"phone_verified":false}',
  'email', now(), now(), now()
);

update profiles set role = 'facilitator' where id = '66666666-0000-0000-0000-0000000f2601';

-- Certified against Tele-Savvy (in_negotiation, not licensed) -
-- facilitator_certifications has no license_status requirement of its
-- own (only cohort assignment does, via enforce_cohort_program_and_
-- facilitator), so this doesn't need this seed's "zero licensed
-- programs" state to change. Three rows exercise all three badge states
-- the certifications screen renders: current, expiring within 60 days,
-- and expired.
insert into facilitator_certifications (id, facilitator_id, program_id, certified_on, expires_on, certifying_body) values
  (
    '33333333-0000-0000-0000-0000000f2601', '66666666-0000-0000-0000-0000000f2601',
    (select id from programs where name = 'Tele-Savvy'),
    current_date - 300, current_date + 200, 'BPC National Training Center'
  ),
  (
    '33333333-0000-0000-0000-0000000f2602', '66666666-0000-0000-0000-0000000f2601',
    (select id from programs where name = 'Tele-Savvy'),
    current_date - 340, current_date + 30, 'BPC National Training Center'
  ),
  (
    '33333333-0000-0000-0000-0000000f2603', '66666666-0000-0000-0000-0000000f2601',
    (select id from programs where name = 'Tele-Savvy'),
    current_date - 400, current_date - 5, 'BPC National Training Center'
  );

-- F3 QA fixture: a real cohort assigned to Renata, so /facilitator/
-- schedule -> prep is actually clickable, not just pgTAP/vitest-verified.
-- No program_id: every program in this seed stays unlicensed by design
-- (see the X2 seed comment above) and enforce_cohort_program_and_
-- facilitator only skips its license check when program_id is null -
-- same "null is the honest state, not a shortcut" reasoning the L5 Demo
-- Cohort already uses. That means this fixture can only demonstrate
-- F3's roster half live - materials are certification-gated per
-- *program*, so they need a real program_id to attach to at all, which
-- would require flipping a program to 'licensed' outright. Not done
-- here - see docs/qa/F3.md for why, and for the pgTAP/vitest suites that
-- verify the materials/certification-gating half instead.
insert into cohorts (id, name, grouping_description, capacity, cadence, meeting_day_of_week, meeting_time, time_zone, facilitator_id, status) values
  (
    '99999999-0000-0000-0000-0000000f2601', 'Renata''s Cohort (F3 QA fixture)',
    'Fixture cohort for testing the facilitator session-prep roster',
    8, 'weekly', 2, '18:30', 'America/New_York', '66666666-0000-0000-0000-0000000f2601', 'active'
  );

insert into applicants (id, partner_organization_id, referral_source, first_name, last_name, status, cohort_id) values
  (
    '88888888-0000-0000-0000-0000000f2601',
    (select id from partner_organizations where name = 'Riverside Health Network'),
    'partner_link', 'Jamie', 'Ellis', 'enrolled', '99999999-0000-0000-0000-0000000f2601'
  );

insert into sessions (id, cohort_id, session_number, scheduled_at) values
  ('55555555-0000-0000-0000-0000000f2601', '99999999-0000-0000-0000-0000000f2601', 1, now() + interval '7 days');
