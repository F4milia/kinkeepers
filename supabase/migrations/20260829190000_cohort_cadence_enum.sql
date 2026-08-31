-- cadence has been free text since A2's stub, fine for display-only use.
-- Real session-date generation (this migration's companion functions)
-- needs it to mean something specific (7 vs 14 days), so it becomes a
-- real enum here. Existing values in the wild aren't just "Weekly" - the
-- seed script (supabase/seed.sql, added independently by Stream B) uses
-- "every Tuesday"/"every Thursday" for its own sample cohorts, and
-- seed.sql runs after every migration on a reset, so this also has to
-- convert cleanly for whatever it inserts. Everything seen so far means
-- weekly; matched defensively by keyword rather than an exact string, so
-- an actual "biweekly"/"every other week" phrasing (none exists yet)
-- would still map correctly if one ever does.
create type cohort_cadence as enum ('weekly', 'biweekly');

alter table cohorts
  alter column cadence type cohort_cadence
  using (
    case
      when cadence ilike '%biweekly%' or cadence ilike '%every other%' then 'biweekly'::cohort_cadence
      else 'weekly'::cohort_cadence
    end
  );
