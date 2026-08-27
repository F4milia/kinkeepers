-- Referral capture, intake, status model, and waitlist grouping (P2).
--
-- Scope note: this migration also extends profiles (P1) with a nullable
-- partner_organization_id column. That's not out-of-scope creep - P2's
-- own acceptance criteria requires an RLS test proving "a partner
-- organization cannot see another's referrals," authenticated as a real
-- partner-staff user, and that test needs a way to know which partner
-- org an authenticated user belongs to. A1 (Wave 2) builds the actual
-- admin UI for managing this column; P2 only adds what its own RLS test
-- needs, same pattern as the partner_organizations migration itself.

alter table profiles add column partner_organization_id uuid references partner_organizations (id);

create type applicant_status as enum (
  'referred', 'intake_complete', 'pending_review', 'enrolled',
  'attending', 'completed', 'declined', 'withdrawn'
);

-- The exact four values are named in the P2 prompt itself, not invented.
create type care_recipient_stage as enum ('early', 'middle', 'late', 'unsure');

create type referral_source as enum ('partner_link', 'staff_form');

-- Matches the three-value shape P4-pre's notification preference already
-- uses ("Channel: email, SMS, or both") - same concept, kept consistent.
create type contact_channel as enum ('email', 'sms', 'both');

create table applicants (
  id uuid primary key default gen_random_uuid(),
  partner_organization_id uuid not null references partner_organizations (id),
  referral_source referral_source not null,
  -- Opaque partner-supplied string. Never parsed, never shown to the
  -- applicant/member - only echoed back in the partner export (A5).
  partner_reference_id text check (char_length(partner_reference_id) <= 64),

  -- Intake fields (9, under the "ten fields maximum" cap) - all
  -- nullable except what exists at referral-creation time, so partial
  -- intake progress can be saved before every field is filled in.
  first_name text,
  last_name text,
  email text,
  phone text,
  time_zone text,
  relationship text,
  care_recipient_stage care_recipient_stage,
  availability_windows jsonb,
  preferred_contact_channel contact_channel,

  status applicant_status not null default 'referred',
  -- Set (and reset, if it happens more than once) whenever status
  -- transitions to 'pending_review' - see log_applicant_status_event()
  -- below. Denormalized deliberately: the waitlist view needs "how long
  -- has this applicant been waiting," and computing that by joining
  -- applicant_status_events would require granting authenticated
  -- SELECT on that table, which defeats the point of it being
  -- append-only-and-locked-down like audit_log. This column lets the
  -- waitlist view stay scoped by applicants' own RLS alone.
  pending_review_since timestamptz,
  created_at timestamptz not null default now()
);

-- Deliberately no unique constraint on email/phone: referring the same
-- caregiver via both the partner link and the staff form is expected to
-- create two separate pending records, not merge them (P1's named edge
-- case for this session - "two pending records, correct sources, both
-- queryable").

alter table applicants enable row level security;

-- Default ACLs grant FULL privileges to anon/authenticated/service_role
-- automatically at creation time (CLAUDE.md's Learned constraints,
-- 2026-08-26 entry). Explicit revoke first, then grant exactly what's
-- needed.
revoke all on applicants from anon, authenticated;
grant all on applicants to service_role;

-- No anon/authenticated grant for INSERT: referral creation and intake
-- updates go through server-side Server Actions (service-role client),
-- not direct client table writes - same pattern P1's sign-in flow used,
-- needed here anyway since referral/intake involves validation and
-- partner-slug-to-id resolution that don't belong in an RLS policy.
--
-- SELECT is granted to authenticated (not anon - nobody reads applicant
-- data unauthenticated) and scoped by RLS: the referring partner
-- organization's own staff, or internal admin. This is also what makes
-- partner_reference_id "visible only to the referring partner
-- organization and internal admin" true - the whole row is scoped, so
-- there's no separate column-level policy needed for that field
-- specifically.
grant select on applicants to authenticated;

create policy "applicants_select_own_partner_org_or_admin"
  on applicants for select
  to authenticated
  using (
    partner_organization_id = (select partner_organization_id from profiles where id = auth.uid())
    or (select role from profiles where id = auth.uid()) = 'admin'
  );

-- Append-only event log. Same append-only pattern as audit_log (P7a):
-- service_role gets insert+select only, UPDATE/DELETE/TRUNCATE revoked
-- explicitly - a status history that could be edited after the fact
-- isn't a history.
create table applicant_status_events (
  id bigint generated always as identity primary key,
  applicant_id uuid not null references applicants (id),
  from_status applicant_status,
  to_status applicant_status not null,
  -- Nullable: P2's own transitions (referral submission, intake
  -- completion) are self-service/system-initiated, no authenticated
  -- staff actor involved. A2 (Wave 3), whose assign/decline actions DO
  -- have a real actor, should set `set_config('app.current_actor_id',
  -- ..., true)` before its status-changing update so the trigger below
  -- can pick it up - see log_applicant_status_event().
  actor_id uuid references profiles (id),
  reason text,
  created_at timestamptz not null default now()
);

alter table applicant_status_events enable row level security;
revoke all on applicant_status_events from anon, authenticated;
revoke update, delete, truncate on applicant_status_events from service_role;
grant insert, select on applicant_status_events to service_role;
grant usage on sequence applicant_status_events_id_seq to service_role;

-- No policies for anon/authenticated - default deny at the grant level,
-- same as sign_in_events and audit_log. A2/A5 read this server-side via
-- the service-role client, same as those tables.

create index applicant_status_events_applicant_id_idx on applicant_status_events (applicant_id);

-- Stamps NEW.pending_review_since when the transition is into
-- 'pending_review'. Must be BEFORE (to modify NEW before the row is
-- written) and must NOT also insert into applicant_status_events here:
-- a BEFORE trigger runs before this row physically exists in
-- applicants, so an insert into applicant_status_events referencing
-- new.id via its foreign key would fail (confirmed by hand - this was
-- the first version of this migration, and it failed exactly that way).
-- The event-logging half is a separate AFTER trigger below, once the
-- row genuinely exists.
create function stamp_applicant_pending_review_since()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending_review'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.pending_review_since := now();
  end if;
  return new;
end;
$$;

revoke execute on function stamp_applicant_pending_review_since from public, anon, authenticated;
grant execute on function stamp_applicant_pending_review_since to service_role;

create trigger applicants_stamp_pending_review_since
  before insert or update on applicants
  for each row execute function stamp_applicant_pending_review_since();

-- Every status transition writes an event automatically - not left to
-- app-code discipline to remember. AFTER, not BEFORE: see the comment
-- above on why the row needs to exist first.
create function log_applicant_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_actor_id uuid;
begin
  begin
    acting_actor_id := nullif(current_setting('app.current_actor_id', true), '')::uuid;
  exception when others then
    acting_actor_id := null;
  end;

  if tg_op = 'INSERT' then
    insert into public.applicant_status_events (applicant_id, from_status, to_status, actor_id)
    values (new.id, null, new.status, acting_actor_id);
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.applicant_status_events (applicant_id, from_status, to_status, actor_id)
    values (new.id, old.status, new.status, acting_actor_id);
  end if;

  return new;
end;
$$;

revoke execute on function log_applicant_status_event from public, anon, authenticated;
grant execute on function log_applicant_status_event to service_role;

create trigger applicants_log_status_event
  after insert or update on applicants
  for each row execute function log_applicant_status_event();

-- Waitlist: applicants sitting in pending_review, grouped by
-- relationship and stage, with the oldest wait in each group - answers
-- "which groupings have enough people waiting to open a new cohort"
-- (A2 renders this; P2 only builds the data/query per the AMENDMENT).
-- security_invoker means this view respects the QUERYING role's RLS on
-- applicants, not the view owner's - a partner-staff user querying this
-- view only ever sees their own organization's waiting applicants
-- reflected in the counts, same isolation as querying applicants
-- directly. Internal admin, via the same RLS policy, sees everyone.
-- Deliberately queries applicants alone, not a join to
-- applicant_status_events - see pending_review_since's comment on the
-- applicants table for why.
create view applicant_waitlist_summary
  with (security_invoker = true)
  as
  select
    relationship,
    care_recipient_stage,
    count(*) as waiting_count,
    min(pending_review_since) as oldest_wait_started_at
  from applicants
  where status = 'pending_review'
  group by relationship, care_recipient_stage;

grant select on applicant_waitlist_summary to authenticated;
