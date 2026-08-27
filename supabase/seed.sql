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
