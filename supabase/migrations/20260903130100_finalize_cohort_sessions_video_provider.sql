-- Based on the CURRENT (and only ever) body of finalize_cohort_sessions
-- from 20260829190100_cohort_creation_functions.sql - confirmed via grep
-- across every migration before writing this, per the standing "never
-- edit an already-applied migration, and never base a replacement on a
-- stale copy of the function body" rule (see CLAUDE.md's Learned
-- Constraints, A3/2026-09-01 and X3/2026-09-03 entries for two different
-- times getting this wrong cost a real regression). Only new parameter
-- is p_video_provider; every other line is unchanged from the original.
--
-- CREATE OR REPLACE alone is NOT enough here, and this was caught for
-- real (not assumed) by the full pgTAP suite: Postgres identifies a
-- function by (name, parameter TYPE list), and adding a new parameter -
-- even one with a default - changes that type list, so CREATE OR REPLACE
-- creates a second, overloaded function instead of replacing the
-- original. The result was "function finalize_cohort_sessions(...) is
-- not unique" on every call, since both the old 9-parameter and new
-- 10-parameter versions matched. The explicit DROP below removes the old
-- signature first, so only one version of this function ever exists.
drop function if exists finalize_cohort_sessions(
  uuid, uuid, text, text, text, text, text, timestamptz[], text[]
);

create function finalize_cohort_sessions(
  actor_id uuid,
  target_cohort_id uuid,
  p_video_meeting_id text,
  p_video_join_url text,
  p_video_passcode text,
  p_video_dial_in_number text,
  p_video_dial_in_pin text,
  session_instants timestamptz[],
  video_occurrence_ids text[] default null,
  p_video_provider text default 'kinkeepers'
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
      video_occurrence_id, video_provider
    )
    values (
      target_cohort_id, i, session_instants[i],
      p_video_meeting_id, p_video_join_url, p_video_passcode, p_video_dial_in_number, p_video_dial_in_pin,
      video_occurrence_ids[i], p_video_provider
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

-- DROP FUNCTION removes any grants that existed on the old signature -
-- this is a genuinely new function object, so its own grants need to be
-- stated explicitly, same as the original migration did. Default ACLs
-- would otherwise leave EXECUTE granted to anon/authenticated (CLAUDE.md's
-- own "Supabase default ACLs are permissive" lesson).
revoke execute on function finalize_cohort_sessions from public, anon, authenticated;
grant execute on function finalize_cohort_sessions to service_role;
