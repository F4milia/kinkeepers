-- Hardening fix, found by re-running the P1 pgTAP suite after a routine
-- `supabase db reset` pulled newer local images: `anon` and `authenticated`
-- both showed up with full raw grants (arwdDxtm) on profiles and
-- sign_in_events, neither of which this repo's migrations ever granted.
--
-- Root cause, confirmed via:
--   select * from pg_default_acl join pg_namespace on ...
-- There is a default ACL for role `postgres` (the role our migrations run
-- as) on schema `public`, granting ALL privileges on new relations to
-- anon/authenticated/service_role automatically at CREATE TABLE time. That
-- default ACL is set by Supabase's own local-dev bootstrap, not by
-- anything in this repo, and evidently changed behavior between one local
-- image pull and the next - so "we never explicitly granted it" is not a
-- safe assumption to build security on, on this platform.
--
-- RLS was still doing its job throughout (profiles_select_own is scoped
-- `to authenticated` only, so anon got zero visible rows either way;
-- sign_in_events has no policies at all, so both anon and authenticated
-- got zero visible rows) - this was not a data exposure, but the "hard
-- permission-denied, not just filtered" guarantee the original migration
-- documented and pgTAP-tested no longer held. Explicit REVOKE closes that
-- gap regardless of what any default ACL does going forward.

-- The same default ACL also gave `authenticated` full privileges on
-- profiles (insert/update/delete, not just the select this repo actually
-- grants) - revoke and re-grant precisely, rather than leaning on RLS
-- alone to cover the gap between "what we meant to grant" and "what got
-- auto-granted".
revoke all on profiles from anon, authenticated;
grant select on profiles to authenticated;

revoke all on sign_in_events from anon, authenticated;
