-- A5's own acceptance line requires the reminder-failures admin screen
-- to show "member, session, channel, error" (its own prompt text) for
-- every failed send - found during a 2026-09-08 acceptance audit that
-- notification_log (20260901170000) has no session-identifying column
-- at all. A session id is only ever embedded as a text substring inside
-- the free-text dedup_key (e.g.
-- '{applicant_id}:session_rescheduled:{session_id}:...'), which is not
-- queryable/joinable as a real column - grep confirmed no code anywhere
-- tries to parse it back out for display, and doing so would be fragile
-- (dedup_key's own shape varies per notification_type, per that
-- migration's own comment).
--
-- Nullable: several notification_type values are per-applicant
-- lifecycle events with no session at all (application_received,
-- cohort_assigned, program_complete) - only the session-scoped types
-- (session_rescheduled, session_cancelled, session_reminder_24h,
-- session_reminder_1h, missed_session_followup) will ever populate it.
-- on delete set null, not cascade: a notification_log row is a
-- historical delivery record, not something that should vanish (or
-- block a session delete) just because the session it referenced was
-- later removed - same reasoning already applied to
-- audit_log.actor_id's own no-hard-delete constraint, just the opposite
-- direction (here the referenced row can go, the log row can't).
alter table notification_log add column session_id uuid references sessions (id) on delete set null;

create index notification_log_session_id_idx on notification_log (session_id);
