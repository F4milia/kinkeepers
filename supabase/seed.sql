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
