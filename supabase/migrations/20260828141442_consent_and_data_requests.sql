-- P6: consent and legal surfaces.
--
-- Ivan supplies final attorney-reviewed text; this migration seeds
-- clearly-marked placeholder documents (is_placeholder = true) so the
-- versioning mechanism is real and testable before real text exists.
-- L3 (Wave 5) owns the actual consent-capture UI; this is the schema and
-- logic it builds on, same pattern as P3/P7a landing library code ahead
-- of their consuming UI.

create type consent_document_type as enum (
  'terms_of_service',
  'privacy_policy',
  'participant_agreement',
  'group_confidentiality'
);

-- Versioned, not just a static file: "which version did this person agree
-- to" must stay answerable for any member at any past date, which means
-- the historical text itself has to be a real, immutable row, not
-- something a later edit could silently change out from under an old
-- consent record.
create table consent_documents (
  id uuid primary key default gen_random_uuid(),
  document_type consent_document_type not null,
  version int not null check (version > 0),
  body text not null,
  is_placeholder boolean not null default true,
  effective_at timestamptz not null default now(),
  unique (document_type, version)
);

-- Exactly the shape the session prompt specifies.
create table member_consents (
  id bigint generated always as identity primary key,
  member_id uuid not null references profiles (id),
  document_type consent_document_type not null,
  document_version int not null,
  agreed_at timestamptz not null default now(),
  ip_hash text,
  foreign key (document_type, document_version) references consent_documents (document_type, version)
);

-- A version bump does NOT silently re-consent existing members - it
-- creates a new document_documents row, and a member's prior
-- member_consents row for the old version stays exactly as it was. This
-- unique constraint is what makes "consented, then re-consented after a
-- bump" two distinct rows rather than an overwrite.
create unique index member_consents_member_document_version_idx
  on member_consents (member_id, document_type, document_version);

create type data_request_type as enum ('deletion', 'export');
create type data_request_status as enum ('pending', 'fulfilled');

-- Fulfillment is manual for now (per the session prompt) - this table is
-- the request record and timestamp, not the fulfillment mechanism.
-- NOTE for whoever builds fulfillment: a profile that has ever written an
-- audit_log row can never be hard-deleted (actor_id references profiles
-- with no ON DELETE behavior, i.e. RESTRICT - see CLAUDE.md's Learned
-- constraints, P7a entry). "Deletion" here has to mean anonymize/detach
-- the profile, not DELETE it. Aggregate retention data (the P5 event
-- tables, once they exist) survives; identifiable records do not.
create table member_data_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles (id),
  request_type data_request_type not null,
  status data_request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  fulfillment_note text
);

alter table consent_documents enable row level security;
alter table member_consents enable row level security;
alter table member_data_requests enable row level security;

-- New tables get FULL default privileges to anon/authenticated/service_role
-- at CREATE TABLE time (see CLAUDE.md's Architecture notes). Explicitly
-- revoke rather than relying on omission.
revoke all on consent_documents, member_consents, member_data_requests from anon, authenticated;

-- consent_documents: any signed-in user can read (they need to read the
-- current text to consent to it); only service_role writes new versions.
grant select on consent_documents to authenticated;
grant all on consent_documents to service_role;

create policy "consent_documents_select_authenticated"
  on consent_documents for select
  to authenticated
  using (true);

-- member_consents: a member can read and record their OWN consent history
-- only - never another member's, never an admin bulk-read via the
-- anon-key client (A5's future admin queue reads via service_role, same
-- pattern as every other admin-facing table so far).
grant select, insert on member_consents to authenticated;
grant all on member_consents to service_role;

create policy "member_consents_select_own"
  on member_consents for select
  to authenticated
  using (member_id = auth.uid());

create policy "member_consents_insert_own"
  on member_consents for insert
  to authenticated
  with check (member_id = auth.uid());

-- member_data_requests: a member can create and read their own requests;
-- writes to status/fulfillment stay service_role-only (A5's future queue).
grant select, insert on member_data_requests to authenticated;
grant all on member_data_requests to service_role;

create policy "member_data_requests_select_own"
  on member_data_requests for select
  to authenticated
  using (member_id = auth.uid());

create policy "member_data_requests_insert_own"
  on member_data_requests for insert
  to authenticated
  with check (member_id = auth.uid());

-- The reusable check: which of the four current document versions has
-- this member not yet consented to (never consented, or consented to an
-- older version). Built now so L3 doesn't have to invent this query.
--
-- security invoker (the default - stated explicitly here for clarity),
-- not security definer: reusing the already-correct member_consents RLS
-- policies is simpler and more robust than reimplementing an "is this
-- caller allowed to check this member_id" guard by hand. An authenticated
-- caller passing another member's id just sees no matching consent rows
-- (their own RLS filters member_consents to member_id = auth.uid()), so
-- every document reads as "needs reconsent" for a mismatched id - wrong
-- and unhelpful, but not a leak of the other member's real status.
-- service_role bypasses RLS entirely, so it can genuinely check anyone
-- (A5's future admin queue).
create function needs_reconsent(check_member_id uuid)
returns table (document_type consent_document_type, current_version int)
language sql
stable
security invoker
set search_path = ''
as $$
  select current.document_type, current.version
  from (
    select cd.document_type, max(cd.version) as version
    from public.consent_documents cd
    group by cd.document_type
  ) as current
  left join public.member_consents mc
    on mc.member_id = check_member_id
    and mc.document_type = current.document_type
    and mc.document_version = current.version
  where mc.id is null;
$$;

revoke execute on function needs_reconsent from public, anon;
grant execute on function needs_reconsent to authenticated, service_role;
