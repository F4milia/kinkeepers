-- P4: closes the three remaining gaps found during acceptance-criteria
-- verification of the reschedule/cancellation notifications (A3 PR4 /
-- P4 PR3): "duplicate job runs send once," "failed sends surface in an
-- admin view (A5 renders the queue)," and "unsubscribe stops delivery
-- without removing enrollment."
--
-- notification_log is the single mechanism serving both the dedup
-- guarantee and the admin failure queue: a UNIQUE constraint on
-- (dedup_key, channel) is what actually makes "duplicate job runs send
-- once" true (enforced by Postgres, not by application-level logic that
-- could race), and the same rows are what A5's failed-notifications
-- screen reads.

create table notification_log (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants (id),
  notification_type text not null,
  channel text not null check (channel in ('email', 'sms')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  -- Identifies "this specific notification attempt" - e.g.
  -- '{applicant_id}:session_rescheduled:{session_id}:{new_scheduled_at}'
  -- for a reschedule (a second reschedule to a DIFFERENT time is a
  -- genuinely new notification, not a duplicate) or
  -- '{applicant_id}:session_cancelled:{session_id}' for a cancellation
  -- (a session can only be cancelled once - enforced by cancel_session's
  -- own "only a scheduled session can be cancelled" guard). The unique
  -- index below is the actual dedup enforcement point.
  dedup_key text not null,
  created_at timestamptz not null default now()
);

create unique index notification_log_dedup_key_channel_idx on notification_log (dedup_key, channel);
create index notification_log_status_idx on notification_log (status);
create index notification_log_applicant_id_idx on notification_log (applicant_id);

alter table notification_log enable row level security;

-- Same pattern as every other admin-only table so far (audit_log,
-- member_data_requests): new tables get FULL default privileges to
-- anon/authenticated/service_role at creation time - explicit REVOKE
-- rather than relying on omission. A5's failed-notifications screen (and
-- the send-mechanism's own dedup check) both read/write via
-- service_role, never via a per-user policy - there is no scenario where
-- a member or partner_staff needs to see this table.
revoke all on notification_log from anon, authenticated;
grant all on notification_log to service_role;

-- Unsubscribe: a member can stop delivery without touching their
-- enrollment (status/cohort_id are untouched by this flow - see
-- lib/referral/unsubscribe.ts). The token is a separate, unguessable
-- identifier - not the applicant's own id - so the public unsubscribe
-- link can't be used to enumerate or target other applicants' records.
alter table applicants add column notifications_opted_out boolean not null default false;
alter table applicants add column notification_unsubscribe_token uuid not null default gen_random_uuid();

create unique index applicants_notification_unsubscribe_token_idx on applicants (notification_unsubscribe_token);
