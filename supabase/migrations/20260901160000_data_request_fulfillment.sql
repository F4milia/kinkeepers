-- A5 (Wave 7): the admin queue for member_data_requests (P6). Per that
-- migration's own comment, "fulfillment is manual for now" - a profile
-- that has ever written an audit_log row can never be hard-deleted
-- (actor_id references profiles with no ON DELETE behavior), so a real
-- automated "delete everything" mechanism is future, unspecified work,
-- not something to invent here. This function's job is exactly what the
-- schema already promises: record that a human fulfilled the request,
-- with a note describing what they actually did, and audit it - not
-- perform the fulfillment itself.

alter type audit_action add value 'member_data_request_fulfilled';

create function mark_data_request_fulfilled(
  actor_id uuid,
  target_request_id uuid,
  note text
)
returns member_data_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_row public.member_data_requests;
begin
  if note is null or btrim(note) = '' then
    raise exception 'a fulfillment note is required';
  end if;

  update public.member_data_requests set status = 'fulfilled', fulfilled_at = now(), fulfillment_note = note
  where id = target_request_id and status = 'pending'
  returning * into updated_row;

  if not found then
    raise exception 'data request % is not pending - only a pending request can be marked fulfilled', target_request_id;
  end if;

  perform public.record_audit_event(
    actor_id,
    'member_data_request_fulfilled'::public.audit_action,
    'member_data_request',
    target_request_id::text,
    note,
    jsonb_build_object('request_type', updated_row.request_type, 'member_id', updated_row.member_id)
  );

  return updated_row;
end;
$$;

revoke execute on function mark_data_request_fulfilled from public, anon, authenticated;
grant execute on function mark_data_request_fulfilled to service_role;
