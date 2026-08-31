-- Cohort creation can't be one atomic SQL function the way A1/A2's
-- mutations are - it involves a real external Zoom API call in the
-- middle, which can't live inside a Postgres transaction. Instead, the
-- Server Action (next PR) inserts a draft cohort, calls Zoom, and then
-- calls exactly one of these two functions depending on the outcome -
-- each keeps its OWN half (the DB-only part, once the Zoom result is
-- already known) atomic with its own audit_log row, same "if the audit
-- write fails, the mutation fails" guarantee as every other privileged
-- action in this codebase.
--
-- This is also what makes the named edge case correct by construction:
-- "kill the Zoom API at meeting 4 of 6 during creation - cohort lands in
-- draft, error names the failure, zero half-scheduled sessions."
-- Sessions are only ever inserted here, in one batch, after Zoom has
-- already fully succeeded - a failure at any point during the Zoom call
-- itself never reaches this function at all, so it's structurally
-- impossible to end up with some-but-not-all session rows.

create function finalize_cohort_sessions(
  actor_id uuid,
  target_cohort_id uuid,
  p_video_meeting_id text,
  p_video_join_url text,
  p_video_passcode text,
  p_video_dial_in_number text,
  p_video_dial_in_pin text,
  session_instants timestamptz[],
  -- Zoom's own per-occurrence id, one per entry in session_instants, same
  -- order - required later to reschedule or cancel a single session's
  -- Zoom occurrence without touching the rest of the recurring series.
  -- Nullable per-element (not every caller may have one yet) rather than
  -- a NOT NULL array, so this stays backward-compatible with the
  -- already-passing test in this same file that doesn't pass any.
  video_occurrence_ids text[] default null
)
returns cohorts
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_row public.cohorts;
  i int;
begin
  for i in 1..coalesce(array_length(session_instants, 1), 0) loop
    insert into public.sessions (
      cohort_id, session_number, scheduled_at,
      video_meeting_id, video_join_url, video_passcode, video_dial_in_number, video_dial_in_pin,
      video_occurrence_id
    )
    values (
      target_cohort_id, i, session_instants[i],
      p_video_meeting_id, p_video_join_url, p_video_passcode, p_video_dial_in_number, p_video_dial_in_pin,
      video_occurrence_ids[i]
    );
  end loop;

  update public.cohorts set status = 'active' where id = target_cohort_id
  returning * into updated_row;

  if not found then
    raise exception 'cohort % not found', target_cohort_id;
  end if;

  perform public.record_audit_event(
    actor_id,
    'cohort_created'::public.audit_action,
    'cohort',
    target_cohort_id::text,
    null,
    jsonb_build_object('session_count', coalesce(array_length(session_instants, 1), 0))
  );

  return updated_row;
end;
$$;

revoke execute on function finalize_cohort_sessions from public, anon, authenticated;
grant execute on function finalize_cohort_sessions to service_role;

-- The cohort stays in 'draft' (its state since the initial insert) -
-- this only records what went wrong and audits the failed attempt.
create function mark_cohort_creation_failed(
  actor_id uuid,
  target_cohort_id uuid,
  error_message text
)
returns cohorts
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_row public.cohorts;
begin
  update public.cohorts set zoom_setup_error = error_message where id = target_cohort_id
  returning * into updated_row;

  if not found then
    raise exception 'cohort % not found', target_cohort_id;
  end if;

  perform public.record_audit_event(
    actor_id,
    'cohort_creation_failed'::public.audit_action,
    'cohort',
    target_cohort_id::text,
    error_message,
    null
  );

  return updated_row;
end;
$$;

revoke execute on function mark_cohort_creation_failed from public, anon, authenticated;
grant execute on function mark_cohort_creation_failed to service_role;
