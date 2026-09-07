# Incident response — a bad merge reaches production

One page, plain language, for whoever is on when this happens. As of
R1's production cutover (2026-09-04), there are two genuinely separate
hosted Supabase projects: staging (`lupiicjafzrbihaosezv`, wired to
Vercel's Preview environment only) and production (`vnadfnnckmkswfrzfjkj`,
wired to Vercel's Production environment only) - see `README.md`'s
Environments section for the full detail. A code deploy never moves data
between them, and every open PR's preview deployment reads and writes
staging, never production. This means a bad merge reaching a PR's preview
build is not yet an incident - the steps below apply once the merge has
actually reached `main` and Vercel's Production deployment.

**Before relying on this page for a real incident**, read
`docs/supabase-cutover-checklist.md` if you're unsure whether production's
dashboard-only configuration (Auth URL settings, custom SMTP, admin role
grants, session inactivity timeout) is currently correct - none of it is
visible to `git diff`, `supabase db diff`, or any test suite, and a new
Supabase project does not inherit any of it automatically.

## Roles

- **Ferenz Panisan** - executor. Runs deploys, merges PRs, is the first
  person who notices or is told something is wrong, and performs the
  rollback steps below.
- **Ivan Rattliff** - owner. Decides whether an incident needs member
  communication beyond what's already automatic (see below), and is the
  contact for anything touching Zoom account settings, licensing, or
  legal/consent documents specifically.

If you are neither of these and are reading this because something broke:
call **1-800-555-0142** (the same number that appears in every error
state in the app itself) and ask for Ferenz or Ivan by name.

## What "a bad merge reaches production" looks like here

Vercel deploys automatically from `main` on every merge (confirmed
working - see CLAUDE.md's Learned Constraints for the incident where this
silently stopped working for an extended period, and how it was caught
and fixed). There is no staging deploy step in between: a merged PR is
live within minutes. A merge to `main` is gated on the required `ci`
check (lint, typecheck, the full pgTAP suite, `npm run test`, `npm run
build` - see `.github/workflows/ci.yml`; confirmed as an actually
enforced branch-protection rule via `gh api
repos/F4milia/kinkeepers/branches/main/protection`, not just a workflow
that happens to exist) - so "a bad merge reached production" always means
something the gate itself couldn't catch (a real user-facing bug in
otherwise-passing code, a dashboard-only config gap, an external API
behaving differently than assumed), not a skipped check.

**Timing, measured, not assumed:** recent `ci` runs on `main` (`gh run
list --workflow=ci.yml --branch main`) consistently complete in
3.5-4.5 minutes; recent Vercel Production deployments (`vercel ls`)
consistently build in 1-2 minutes. Merging a green PR to a live production
deploy is well under 10 minutes end to end, checked directly against
real run history rather than assumed from the pipeline's shape.

## First response

1. **Confirm it's actually broken**, not assumed broken. Curl a route the
   suspected bad change touches, or load the actual screen. CLAUDE.md's
   own Learned Constraints record two real incidents where "merged" and
   "live" were wrongly treated as the same claim - they are not one
   claim, verify both independently.
2. **Roll back the deploy**, not the code, first - this is faster and
   buys time to fix forward properly:
   ```
   npx vercel rollback --yes
   ```
   This points production at the previous READY deployment immediately.
   Confirm it worked the same way you confirmed the break - reload the
   actual screen, don't trust the command's own success message alone.
3. **If the break is a database migration**, a Vercel rollback alone will
   NOT undo it - the previous deployment's code will now be running
   against a schema it wasn't built for, which can be its own new
   failure. Check `docs/migration-rollback-decisions.md` for that
   specific migration's own recorded decision before doing anything else
   to the database. Most migrations in this repo are documented as
   forward-fix-only (a down-path was judged unsafe) - the fix is very
   likely a new migration, not an undo.
4. **Fix forward** on a new branch once the immediate bleeding is
   stopped. Never skip CI to merge a fix faster - a rushed, unverified
   fix on top of a live incident is how incidents compound.

## Telling members, if a real session was affected

Do not write new copy in the moment. This app already has a real,
tested notification pipeline for exactly two of the situations most
likely to result from an incident - use it, don't improvise:

- A session that had to be rescheduled or cancelled because of the
  incident: the facilitator (or Ferenz/Ivan, if the facilitator can't be
  reached) reschedules or cancels the session through the normal admin
  flow (`/admin/cohorts/[id]`), which fires the real
  `session_rescheduled`/`session_cancelled` member notifications
  automatically - see `lib/messaging/session-notifications.ts`. This is
  the same message a member would get for an ordinary schedule change,
  which is deliberate: an incident is not a reason to depart from the
  plain, warm, no-alarm tone every other message in this app already
  uses.
- If no session was actually missed or affected - the incident was
  caught and rolled back before a real session's time arrived - no
  member communication is needed at all. Do not send a message just to
  announce that something was fixed; CLAUDE.md's own copy rules already
  forbid invented reassurance, and an unprompted "everything is fine now"
  message to this population reads as more alarming, not less.

There is no other member-facing incident-communication path in this app
today (no status page, no mass-email tool) - if something happened that
doesn't fit the reschedule/cancel case above, Ivan decides the wording
and channel by hand, using the same plain-language, phone-number-first
voice as everywhere else, never a template invented for this document.

## After

Add a line to CLAUDE.md's Learned Constraints section per the project's
own standing rule: what broke, why the gates in place (CI, pgTAP,
review) didn't catch it, and what changed as a result. This page exists
because of Learned Constraints entries just like the ones it already
references above - it is not exempt from adding to that record itself.

## Known gap: the rollback drill described above has not been executed

R1's own acceptance criterion calls for a staged rollback drill - deploy,
migrate, roll back, verify data intact and app healthy, in staging, with
this page as the drill's real transcript rather than a hypothetical
procedure. That drill has never actually been run (confirmed via
`docs/qa/R1-incident-notes-and-rollback-decisions.md`'s own line 7,
written by R1's original session: "the real production cutover and
staged rollback drill are held out"). Everything above this section is a
plain-language procedure, reasoned to be correct, not a record of steps
that were actually executed and observed to work. Running it deliberately
- picking one of the "down-path tested" migrations in
`docs/migration-rollback-decisions.md`, deploying to staging, rolling
back, and confirming staging's real data survives - is real infrastructure
work against a shared environment and needs a human (Ferenz or Ivan) to
schedule and execute it, not an unattended agent pass. Until that happens,
treat the steps above as reasoned-but-unverified, and update this section
with the real transcript (what was run, what was observed, timestamps)
the day it's actually done.
