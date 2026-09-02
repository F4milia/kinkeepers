# Named QA fixtures

Adapted from Ivan's `qa-previous-session-sop.md`, which was written in a
different project's terms (Family/Build/Bricks, `f4milia.test` emails) -
these are KinKeepers' own real entities instead, and only what genuinely
exists in `supabase/seed.sql` today. `seed.sql` grows incrementally
(X1's own rule: "do not pre-seed rows for tables that don't exist yet"),
so this table grows the same way - add a row here in the same PR that
adds the fixture to `seed.sql`, don't seed ahead of need.

Every fixture below is reset from scratch on `supabase db reset --local`.
It is NOT currently guaranteed present on a preview deploy - see "Real
blocker" below before assuming a QA doc's fixtures match what a preview
URL actually shows.

| Fixture | What it's for | Real id / lookup |
|---|---|---|
| Riverside Health Network | Partner org, active referrals | `partner_organizations.name = 'Riverside Health Network'` |
| Lakeside Family Medicine | Second partner org, for isolation checks (A org can't see B org's referrals) | `partner_organizations.name = 'Lakeside Family Medicine'` |
| Miriam Castillo | Oldest pending_review applicant (backdated 12 days) - oldest-first sort, "waiting for review" status screen | `88888888-0000-0000-0000-000000000001` |
| Priya Desai | Newest pending_review applicant (backdated 1 day), same relationship/stage as Miriam - waitlist grouping counts >1 | `88888888-0000-0000-0000-000000000002` |
| Oscar Bennett | pending_review, different partner org/relationship/stage | `88888888-0000-0000-0000-000000000003` |
| Frank Delgado | declined applicant, reason `unresponsive` - reopen flow | `88888888-0000-0000-0000-000000000004` |
| Sam Ellison | enrolled applicant with a real assigned first session (L5 Demo Cohort) - "assigned, before session one" status screen | `88888888-0000-0000-0000-000000000502` |
| Terry Whitfield | completed applicant, no next program - "program complete" status screen | `88888888-0000-0000-0000-000000000503` |
| L5 Demo Cohort | Real cohort with one real scheduled session (video, real join URL) - the only cohort with a session an applicant is actually assigned to | `99999999-0000-0000-0000-000000000501` |
| "Spouses, Early Stage" / "Adult Children, Middle Stage" | Two open A2-era cohorts with different capacity/cadence/zone, for the assignment picker's composition view | `99999999-0000-0000-0000-000000000001` / `...002` |
| Four consent documents (v1) | Terms/privacy/participant/group-confidentiality, all placeholder text pending Ivan's attorney-reviewed versions | `consent_documents` |
| Renata Solis | Real, sign-in-able facilitator account (the first of its kind in this file - see "Signing in as a fixture" below) with three certifications covering all three badge states: current, expiring within 60 days, and expired | `auth.users.id = 66666666-0000-0000-0000-0000000f2601`, email `ferenz+kinkeepers@brandlamb.com` (a real inbox, not the usual `@example.com` fictional pattern - see the seed comment for why) |
| Renata's Cohort (F3 QA fixture) | A real cohort assigned to Renata, one enrolled member (Jamie Ellis), one upcoming session - `/facilitator/schedule` links it to F3's prep view. No `program_id` (every program in this seed stays unlicensed by design - see the X2 seed comment), so it can only demonstrate the roster half of prep live; materials/certification-gating need a real program and are verified by `supabase/tests/database/session_prep_materials.sql` and `lib/data.test.ts` instead, not a click-through | `99999999-0000-0000-0000-0000000f2601`, session `55555555-0000-0000-0000-0000000f2601` |
| Jamie Ellis | Real, sign-in-able MEMBER account (Renata's Cohort's own enrolled applicant, above) - L3's `/account` needed a caregiver identity to actually sign in as, the same gap F2 found for facilitator screens. Left unclaimed at seed time (`applicants.profile_id` is null) so signing in exercises the real L5 claim-by-email match live, not a pre-linked shortcut | `applicants.id = 88888888-0000-0000-0000-0000000f2601`, `auth.users.id = 66666666-0000-0000-0000-0000000f3601`, email `ferenz+kinkeepers-member@brandlamb.com` (same real-inbox exception as Renata Solis, above - see "Signing in as a fixture") |

## Signing in as a fixture

Renata Solis (facilitator) and Jamie Ellis (member, above) are the only
real accounts today - every other fixture is plain data with no login
capability. `seed.sql` can't call Supabase's Admin API (it's pure SQL run
via `supabase db reset`), so both are seeded by inserting directly into
`auth.users`/`auth.identities` with the columns a real magic-link sign-in
needs - verified end-to-end before adding either: a real OTP email
arrived and redeeming its link returned a genuine session for that exact
row.

To sign in as either locally: go to `/sign-in`, enter the fixture's email
(`ferenz+kinkeepers@brandlamb.com` for Renata,
`ferenz+kinkeepers-member@brandlamb.com` for Jamie), then open Mailpit
(`http://127.0.0.1:54364` by default - check `supabase status`'s
`MAILPIT_URL` if that's changed) and click the link in the "Your sign-in
link" email. Local sign-in always routes through Mailpit regardless of
the email's real deliverability, so this works the same way it would for
any address. On production, both emails actually deliver to Ferenz's real
inbox (plus-addressing) - confirmed live for Renata first (an earlier
attempt using the usual `@example.com` fictional pattern failed there
with "We couldn't send that," since Resend genuinely refuses to deliver
to a non-existent domain; these fixtures are the exception to the
fictional-address convention for exactly that reason), and Jamie's own
distinct address follows the identical pattern. See the "Real blocker"
section below for the broader caveat this doesn't resolve: production and
preview still share the same database, these fixtures' logins just happen
to also work there now.

## Known gap

The hosted/staging project has accumulated its own ad-hoc named rows from
manual testing sessions (e.g. "Test Cohort4," a "Reminder Manual Test
Org") that were never formalized into `seed.sql` - they exist only on
whichever environment they were created against, not reproducibly. This
doc intentionally doesn't reference those: a QA doc should only cite
fixtures that reset are here in `seed.sql`, so every environment
(including a fresh local reset) has them. Formalize a hosted-only fixture
into `seed.sql` the next time a QA doc needs to reference it by name.

**Also note:** there's no nightly reset cron running against the hosted
project, and per Ferenz's direction (2026-09-02), **none should be built
until this next gap is closed:**

## Real blocker: no separate staging project exists

Checked directly against Vercel's own environment variable config:
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set to the
*same* values for both the `production` and `preview` targets. Every
preview deployment (every open PR) and the live production site all
point at the one Supabase project - the "hosted" project referenced
throughout this session's manual testing.

X1's original Wave 0 spec called for a genuinely separate staging
project ("Separate Supabase project, separate database... Staging must
NEVER send real messages"). In practice, everything converged onto one
shared project instead - X1's own separate-credentials/no-real-messages
guarantees may not actually hold today either, not just the reset-cron
piece.

This makes an automatic nightly `supabase db reset --linked` (as
`qa-previous-session-sop.md` literally describes it) genuinely dangerous
as written: it would wipe the live production site's data on the same
schedule as "staging," not just isolated test data. Confirmed with
Ferenz before building anything here - holding off on any nightly reset
cron until a real, separate staging Supabase project exists with its own
credentials, with Vercel's `preview` environment pointed at it instead of
production's project. That's real infrastructure work, not a follow-up
tweak to this doc.
