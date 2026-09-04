-- P4-pre's own spec (KINKEEPERS-COMPLETE-RUN-DOC.md): "Channel: email,
-- SMS, or both. Default both." P4's own body repeats it: "Default to
-- both for the first cohort - we will learn what works." The original
-- migration (20260827203458_referral_intake_schema.sql) never actually
-- set a default on preferred_contact_channel, and the intake form's own
-- step-3 contact-preference control is optional - nothing requires a
-- caregiver to touch it before completing intake - so any applicant who
-- skips it gets NULL, not 'both'. lib/messaging/notify-member.ts then
-- compounded this by deliberately treating NULL as "email only," tested
-- and documented as intentional, contradicting the run doc's explicit
-- default in both places it's stated. Found during a 2026-09-05 P4-pre
-- acceptance audit - seed.sql's own fixtures always set this column
-- explicitly, which is why no click-through against seed data ever
-- surfaced it.
--
-- Per CLAUDE.md's own migration-editing rule, this is a NEW migration,
-- not an edit to the original one, since the original has already been
-- applied to shared/hosted environments.
alter table applicants alter column preferred_contact_channel set default 'both';

-- Backfill: every existing NULL becomes the documented default, not an
-- invented value - this is exactly what should have happened at insert
-- time for each of these rows.
update applicants set preferred_contact_channel = 'both' where preferred_contact_channel is null;

-- Enforce it going forward - "Default both" only actually holds if NULL
-- can't recur; the JS-layer fallback this migration also fixes
-- (lib/messaging/notify-member.ts) is now a defensive backstop, not the
-- primary mechanism.
alter table applicants alter column preferred_contact_channel set not null;
