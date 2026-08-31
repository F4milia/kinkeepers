-- A3 PR4: session reschedule, cancellation, and facilitator substitution.
-- Each mutation is its own atomic SQL function (DB write + audit_log row
-- in one transaction), same "if the audit write fails, the mutation
-- fails" guarantee as every other privileged action in this codebase.
-- Unlike cohort creation, none of these three needs a Zoom call inside
-- the transaction - the Server Action layer (next, in lib/admin/
-- session-management.ts) calls Zoom FIRST (reschedule/cancel only;
-- substitution never touches Zoom, since the meeting's host is the
-- account owner, not the facilitator), and only calls the matching
-- function here once that side effect - or its absence, when there's no
-- video_occurrence_id to act on - is already known.
--
-- Notifying enrolled members of a reschedule or cancellation is
-- explicitly deferred: P4 (member notifications) doesn't exist yet.
-- Per the run doc's own allowance, that step is a no-op until P4 ships.

alter type audit_action add value 'session_rescheduled';
alter type audit_action add value 'session_cancelled';
alter type audit_action add value 'session_substitution_recorded';

create function reschedule_session(
  actor_id uuid,
  target_session_id uuid,
  new_scheduled_at timestamptz
)
returns sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_row public.sessions;
  previous_scheduled_at timestamptz;
begin
  select scheduled_at into previous_scheduled_at from public.sessions where id = target_session_id;
  if not found then
    raise exception 'session % not found', target_session_id;
  end if;

  update public.sessions set scheduled_at = new_scheduled_at, status = 'scheduled'
  where id = target_session_id and status = 'scheduled'
  returning * into updated_row;

  if not found then
    raise exception 'session % is not scheduled - only a scheduled session can be rescheduled', target_session_id;
  end if;

  perform public.record_audit_event(
    actor_id,
    'session_rescheduled'::public.audit_action,
    'session',
    target_session_id::text,
    null,
    jsonb_build_object('previous_scheduled_at', previous_scheduled_at, 'new_scheduled_at', new_scheduled_at)
  );

  return updated_row;
end;
$$;

revoke execute on function reschedule_session from public, anon, authenticated;
grant execute on function reschedule_session to service_role;

-- A cancelled session does not count against program completion (spec) -
-- enforced by A3 PR5's own "mark completed" logic simply never counting
-- cancelled rows, not by anything here; this function's only job is the
-- status/reason change and its audit trail.
create function cancel_session(
  actor_id uuid,
  target_session_id uuid,
  reason text
)
returns sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_row public.sessions;
begin
  if reason is null or btrim(reason) = '' then
    raise exception 'a cancellation reason is required';
  end if;

  update public.sessions set status = 'cancelled', cancellation_reason = reason
  where id = target_session_id and status = 'scheduled'
  returning * into updated_row;

  if not found then
    raise exception 'session % is not scheduled - only a scheduled session can be cancelled', target_session_id;
  end if;

  perform public.record_audit_event(
    actor_id,
    'session_cancelled'::public.audit_action,
    'session',
    target_session_id::text,
    reason,
    null
  );

  return updated_row;
end;
$$;

revoke execute on function cancel_session from public, anon, authenticated;
grant execute on function cancel_session to service_role;

-- new_substitute_facilitator_id is nullable on purpose - passing null
-- clears a previously-recorded substitute (e.g. entered in error), which
-- the existing enforce_session_substitute_facilitator trigger already
-- allows (it only validates a non-null value). The cohort's own
-- facilitator_id is never touched here - spec: "the original facilitator
-- stays on the cohort, the substitute is recorded on that session only."
create function record_session_substitute(
  actor_id uuid,
  target_session_id uuid,
  new_substitute_facilitator_id uuid
)
returns sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_row public.sessions;
begin
  update public.sessions set substitute_facilitator_id = new_substitute_facilitator_id
  where id = target_session_id and status = 'scheduled'
  returning * into updated_row;

  if not found then
    raise exception 'session % is not scheduled - a substitute can only be recorded on a scheduled session', target_session_id;
  end if;

  perform public.record_audit_event(
    actor_id,
    'session_substitution_recorded'::public.audit_action,
    'session',
    target_session_id::text,
    null,
    jsonb_build_object('substitute_facilitator_id', new_substitute_facilitator_id)
  );

  return updated_row;
end;
$$;

revoke execute on function record_session_substitute from public, anon, authenticated;
grant execute on function record_session_substitute to service_role;
