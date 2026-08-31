-- Fixes real schema drift on the hosted project: `video_occurrence_id`
-- was added to `sessions` by editing 20260829180000_cohort_creation_schema.sql
-- AFTER that migration's original version had already been applied to
-- hosted (right after A3 PR1's own merge). Supabase's migration tracking
-- is by filename/version, not content - re-pushing the edited file later
-- never re-ran it there, so the column silently never existed on hosted
-- even though every local/CI environment (which builds from a full
-- `db reset` replaying every file's CURRENT content) had it all along.
-- Confirmed as the only drift via `supabase db diff --linked`.
--
-- The lesson, not just the fix: never edit a migration file that may
-- already be applied anywhere (hosted, or any environment that persists
-- migration history rather than resetting it) - always a new file.
-- `if not exists` below is defensive only, so this migration is also
-- safe to run against any environment (like local `db reset`) where the
-- column already exists from the original file's current content.

alter table sessions add column if not exists video_occurrence_id text;
