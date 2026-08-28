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
