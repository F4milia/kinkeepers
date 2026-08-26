-- Append-only admin audit log (P7a). Every privileged action any later
-- session performs writes here - see record_audit_event() below for the
-- composable write path, and lib/audit/record-audit-event.ts for the
-- app-level convenience wrapper for standalone (non-transactional) writes.

create type audit_action as enum (
  'admin_sign_in_link_issued',
  'cohort_assignment',
  'attendance_edit',
  'deletion_fulfillment',
  'role_change'
);

create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references profiles (id),
  action audit_action not null,
  subject_type text not null,
  subject_id text not null,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;

-- New tables get FULL default privileges to anon/authenticated/service_role
-- at CREATE TABLE time - a persistent default ACL on the postgres role for
-- schema public, confirmed present on both local and the hosted project (see
-- P1's harden-grants fix for profiles/sign_in_events; not specific to this
-- migration). This is additive, not a starting point to grant from: omitting
-- a GRANT does nothing here, since the privilege already exists by default.
-- Every restriction below is an explicit REVOKE.
revoke all on audit_log from anon, authenticated;

-- Append-only, enforced at the grant level rather than RLS alone: RLS does
-- not apply to service_role (it bypasses RLS entirely), so if append-only
-- depended only on "no UPDATE/DELETE policy," any code using the
-- admin/service-role client could still edit or delete audit rows. The
-- default ACL above already gave service_role UPDATE/DELETE/TRUNCATE, same
-- as it gave anon/authenticated everything - revoke them explicitly rather
-- than assuming "only grant insert+select" restricts anything (it doesn't;
-- GRANT is additive on top of what's already there).
revoke update, delete, truncate on audit_log from service_role;
grant insert, select on audit_log to service_role;
grant usage on sequence audit_log_id_seq to service_role;

-- No policies at all, matching sign_in_events: this is a hard deny for
-- anon/authenticated (the revoke above already blocks them at the grant
-- level; RLS is defense in depth), not a soft per-row filter. Nothing in
-- the codebase yet resolves "is this caller an admin" as a reusable check
-- (no helper function, no admin route exists), so reading audit_log is
-- server-side-only via the service-role client for now - A5 (Wave 7) owns
-- the actual admin-facing screen and does its own role check there before
-- querying. Revisit if a reusable is_admin() lands before then.
create index audit_log_created_at_idx on audit_log (created_at desc);
create index audit_log_subject_idx on audit_log (subject_type, subject_id);

-- The composable write path. security definer + a fixed search_path so a
-- future privileged-action function (e.g. one A2 writes for cohort
-- assignment) can call this AS PART OF ITS OWN TRANSACTION and insert into
-- audit_log there - if this call fails or raises, the calling function's
-- other writes roll back with it, and vice versa. Calling this via a
-- separate Supabase-js network round-trip from the mutation it's auditing
-- does NOT get this guarantee; the mutation and its audit write must be
-- composed into one Postgres function (or otherwise share one transaction)
-- to be atomic. See the pgTAP test alongside this migration for a worked
-- example of both the atomic and the non-atomic case.
create function record_audit_event(
  actor_id uuid,
  action audit_action,
  subject_type text,
  subject_id text,
  reason text default null,
  metadata jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  insert into public.audit_log (actor_id, action, subject_type, subject_id, reason, metadata)
  values (actor_id, action, subject_type, subject_id, reason, metadata)
  returning id into new_id;
  return new_id;
end;
$$;

-- Functions get the same default-ACL treatment as tables: EXECUTE granted
-- to anon/authenticated/service_role automatically at creation time, not
-- just to PUBLIC. This function inserts under its owner's privileges
-- regardless of caller (security definer), so leaving that default grant in
-- place would let any signed-in user fabricate an audit entry under a false
-- actor_id. Revoke from every role, then grant back only to service_role
-- (server-only application code, or another security definer function
-- composing this one into its own transaction).
revoke execute on function record_audit_event from public, anon, authenticated;
grant execute on function record_audit_event to service_role;
