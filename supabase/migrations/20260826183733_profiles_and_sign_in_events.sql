-- Minimal identity + role foundation for passwordless auth (P1).
--
-- Scope note: this table intentionally holds only what P1 needs (role
-- resolution, never from a client claim). The richer applicant/member
-- schema (name, relationship, intake fields, status model) belongs to P2;
-- when it lands, it should reference profiles.id as its primary key /
-- foreign key rather than duplicating identity. Full RLS scoping by
-- persona (admin/facilitator/partner_staff) is A1's job - this migration
-- only sets the default-deny baseline plus "read your own row".

create type app_role as enum ('admin', 'facilitator', 'partner_staff', 'member');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role app_role not null default 'member',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- RLS policies only filter rows; Postgres still requires the base table
-- grant before a role can query it at all. As of the "always revoked by
-- default" Data API behavior (config.toml's auto_expose_new_tables note -
-- this is the current default and becomes permanent 2026-10-30), NEW
-- tables get zero implicit access for ANY Data API role, including
-- service_role - it is not special-cased. Grant both explicitly.
grant select on profiles to authenticated;
grant all on profiles to service_role;

-- Every signed-in user can read their own role. No insert/update/delete
-- policy exists for anon/authenticated on purpose: role changes are a
-- privileged action, done via the service-role client from server-side
-- code only (until A1 builds the admin UI for it).
create policy "profiles_select_own"
  on profiles for select
  to authenticated
  using (auth.uid() = id);

-- Auto-create a profile row when a new auth user is created, so role
-- resolution never has to special-case "no profile yet".
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Sign-in attempt log: every magic-link/SMS-code request and verification,
-- identifier + method + outcome + IP hash. Backs both the audit
-- requirement ("Log every attempt") and the app-level rate limiter
-- (5/identifier/hour, 15/day) that sits in front of Supabase's own
-- (IP-based, coarser) rate limits.
create type sign_in_method as enum ('email_link', 'sms_code');
create type sign_in_outcome as enum ('sent', 'verified', 'failed', 'rate_limited');

create table sign_in_events (
  id bigint generated always as identity primary key,
  identifier text not null,
  method sign_in_method not null,
  outcome sign_in_outcome not null,
  ip_hash text,
  created_at timestamptz not null default now()
);

-- Default-deny for anon/authenticated: no grant at all (not just "no
-- policy") - querying this table as either role raises a permission error
-- rather than silently returning zero rows. service_role gets an explicit
-- grant (see the note above profiles' grant) since it's the only client
-- (lib/supabase/admin.ts, server-only) that reads or writes this table -
-- it's how we rate-limit and audit before a user has a session at all.
-- service_role bypasses RLS itself, but still needs the base grant.
alter table sign_in_events enable row level security;
grant all on sign_in_events to service_role;
grant usage on sequence sign_in_events_id_seq to service_role;

-- Rate-limit queries filter by identifier and a time window; this index
-- makes "count attempts for X since Y" cheap instead of a table scan.
create index sign_in_events_identifier_created_at_idx
  on sign_in_events (identifier, created_at desc);
