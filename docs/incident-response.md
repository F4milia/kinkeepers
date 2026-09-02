# Incident response — a bad merge reaches production

One page, plain language, for whoever is on when this happens. There is
currently one hosted Supabase project (`lupiicjafzrbihaosezv`) serving as
both the only live environment and what the rest of this repo's docs call
"staging" - see `README.md`'s Environments section. Until a real,
separate production project is provisioned and cut over to (R1's larger,
not-yet-started scope), **every deploy is a production deploy** - there
is no lower-stakes environment a bad merge could land in first.

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
live within minutes.

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
