-- P3's own SCHEMA line lists video_provider alongside sessions' other
-- video_* columns, and its acceptance criterion ("a cohort with its own
-- Zoom credentials uses them") was never built - confirmed by grep before
-- this migration, nothing named video_provider or Zoom-credential-storage
-- exists anywhere in the schema.
--
-- Keyed by partner_organization_id, not cohort_id, despite the
-- acceptance line's literal "a cohort with its own credentials" wording:
-- a cohort's partner_organization_id is known from the moment
-- createCohortAction is called (it's a plain input field), but a
-- cohort's own id only exists AFTER the draft insert, which happens
-- immediately before the real Zoom API call this credential lookup has
-- to feed - there's no window to attach credentials to a cohort_id
-- before they're needed. More fundamentally, the prompt's own stated
-- motivation ("some partners will require we run on THEIR Zoom
-- instance") is inherently about the PARTNER, not an individual cohort -
-- every cohort a partner ever gets should use that same instance, not
-- require re-entering the same secret per cohort. A cohort whose partner
-- has its own credentials still ends up using them, satisfying the
-- acceptance line's actual outcome.
--
-- No admin UI exists yet to populate this table - none is described in
-- the P3 prompt (schema/backend scope only, "design for that from the
-- start"), and no real partner currently needs their own instance. A row
-- here is provisioned directly by whoever sets up that partner's Zoom
-- app, the same manual, service-role-only treatment already given to
-- flipping a program's license_status.
create table partner_zoom_credentials (
  partner_organization_id uuid primary key references partner_organizations (id),
  account_id text not null,
  client_id text not null,
  client_secret text not null,
  created_at timestamptz not null default now()
);

alter table partner_zoom_credentials enable row level security;

-- service_role only, same shape as audit_log's own grant block - no
-- policy needed for anon/authenticated since they hold zero table
-- privileges to even attempt a query. This table exists purely for
-- lib/zoom/credentials.ts's server-only lookup, never reachable from
-- client code, matching the same "never in client code" posture already
-- applied to the default Zoom credentials' own env vars.
revoke all on partner_zoom_credentials from anon, authenticated;
-- Cosmetic, not load-bearing: service_role already holds full privileges
-- on this table via Supabase's own default ACL (CLAUDE.md's "default
-- ACLs are permissive" lesson) - this line was never revoked from
-- service_role, only from anon/authenticated above, so it was never
-- missing in the first place. Kept for the same explicit-intent reason
-- every other service_role-only table in this codebase states it
-- anyway (see referral_intake_schema.sql's identical shape) - verified
-- this is cosmetic, not assumed, see the test file's own drill comment.
grant select, insert, update, delete on partner_zoom_credentials to service_role;

alter table sessions add column video_provider text not null default 'kinkeepers';
