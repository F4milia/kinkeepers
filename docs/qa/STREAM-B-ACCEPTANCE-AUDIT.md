# Stream B — strict acceptance-criteria audit tracker

Started 2026-09-04, at Ferenz's direct instruction: re-verify every Stream B
session against its ORIGINAL acceptance criteria (quoted verbatim from
`KINKEEPERS-COMPLETE-RUN-DOC.md`), one session at a time, no partial credit.
A4-payouts and F3 are permanently out of scope — no payment integrations are
being built.

**Process per session:** side-by-side table (criterion → PASS / FAIL /
NEEDS-LIVE-VERIFICATION, with evidence) → decide what's fixable → fix it,
record what was done → what can't be fixed gets flagged with why. This file
is the running record so none of it gets lost between sessions.

**Status key:** ✅ PASS · 🔧 FIXED (this pass) · 🚩 FLAGGED (can't resolve
without Ivan/Ferenz/live access) · ⏳ NOT YET WALKED THROUGH TOGETHER (found
by the automated first pass below, not yet reviewed side-by-side)

Order matches the run doc's own wave order for Stream B: X1, P7a, P3, L1,
X5a, X2, L2, P6, L3, L4, F1, X3, X5b, A4-cert, F2, P7b.

---

## X1: Staging environment — reviewed with Ferenz 2026-09-04

Acceptance (verbatim): *"staging deploys independently. Seed produces a
browsable multi-cohort program. A reminder job in staging sends nothing
outbound — verified by checking provider logs, not by assuming. Reset
works."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Staging deploys independently | ✅ PASS | Production (`vnadfnnckmkswfrzfjkj`) and staging (`lupiicjafzrbihaosezv`) are genuinely separate Supabase projects, confirmed via `vercel env pull` for both environments. |
| 2 | Seed produces a browsable multi-cohort program | ✅ PASS, confirmed live | Ferenz confirmed on staging: cohorts are real and browsable, none has a program attached - matching `supabase/seed.sql`'s deliberate design (zero seeded programs are `licensed`). He also tried creating a new cohort and confirmed it's blocked, since no program is licensed - this is X2's own core enforcement working correctly on real staging, not just in a test. Counted as a live confirmation of X2's "only licensed programs are selectable... enforce it" criterion too. |
| 3 | Reminder job sends nothing outbound, verified via provider logs | 🔧 FIXED (real gap found and closed) | Ferenz exported staging's real Resend send history (63 rows). Every recipient checked out as a legitimate team address, but tracing why "Your sign-in link"/"Confirm your email address" succeeded found a real gap: `requestEmailLink()`/`requestSmsCode()` call `signInWithOtp()` directly, triggering a real GoTrue-side email/SMS send with zero involvement from `lib/messaging/send-email.ts` - so `assertOutboundMessageAllowed()` never protected this path at all. Staging was only safe because every tester happened to use a real, team-controlled inbox. Fixed in PR #133 - the guard is now called before `signInWithOtp()` in both functions, with tests proving the real Supabase call is never reached for a blocked recipient. Also separately verified `assertOutboundMessageAllowed()` itself against staging's real, live-pulled `APP_ENV`/`STAGING_MESSAGE_ALLOWLIST` values before writing the fix - confirmed it blocks a non-team address and allows the real team address through, using actual deployed config. |
| 4 | Reset works | ✅ PASS, confirmed for real | Ferenz ran `npm run db:reset:staging` himself, then confirmed in Supabase Studio (`lupiicjafzrbihaosezv` → `cohorts` table) that all 4 expected seed fixtures reappeared fresh - not just that the command exited without error. |
| 5 | (fuller prompt, not literal acceptance line) Separate Zoom app credentials | 🚩 FLAGGED — confirmed FALSE | Confirmed via direct Vercel API query: staging and production share the exact same `ZOOM_ACCOUNT_ID`/`ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET`. Needs a second real Zoom Server-to-Server OAuth app from Ivan — not fixable in code. |
| 6 | `README.md` documents staging-vs-production differences | 🔧 FIXED | PR #130 — rewrote the Environments section to reflect the real post-cutover state, and corrected `lib/zoom/client.ts`'s comment, which had cited the README for a claim it never made. |

**X1 is fully settled** except #5 (shared Zoom credentials, confirmed real, needs Ivan to provision a second real Zoom app - not resolvable in code). Also found and fixed along the way, unrelated to any single numbered item: staging's real admin account was wiped by the reset (`db reset --linked` recreates the whole `auth` schema, and neither `seed.sql` nor any migration ever grants `role = 'admin'` to anyone - same gap Stream A already found and hand-fixed for the production cutover). Ferenz re-elevated it manually via Supabase Studio's SQL editor, same one-off method as production. Worth a real fixture eventually (a seeded, sign-in-able staging admin, the same pattern already used for Renata Solis/Jamie Ellis), but out of scope for this audit pass.

---

## P7a: Audit log and structured logging — reviewed with Ferenz 2026-09-04

Acceptance (verbatim): *"audit log is append-only and captures all five
privileged action types with actor, action, subject, timestamp. Structured
logs contain identifiers only — verified by inspecting output for a seeded
flow. Health check correctly reports a degraded dependency."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Append-only | ✅ PASS | `audit_log` revokes UPDATE/DELETE/TRUNCATE even from `service_role`; pgTAP proves both throw. |
| 2 | Captures all five privileged action types w/ actor/action/subject/timestamp | ✅ PASS (substance), naming drift noted | The 4 real categories (admin sign-in links, cohort assignment, attendance edits, deletion fulfillment) all write correctly. 3 of the original 5 seeded enum literal names are dead code (real code uses later-added, differently-named values) — Postgres can't drop enum values, not fixable, not worth fixing. |
| 3 | Structured logs contain identifiers only | ✅ PASS | Real call sites checked — only ids/types passed, never content. Real forced-failure test on the health-check path. |
| 4 | Health check correctly reports a degraded dependency | ✅ PASS | Real test stubs an unreachable DB, asserts `"degraded"`/503, not just the happy path. |

**Verdict: clean pass, nothing to fix.**

---

## P3: Zoom for Healthcare integration — reviewed with Ferenz 2026-09-04

Acceptance (verbatim): *"cohort creation produces a recurring meeting with
all five enforced settings verified via the Zoom API. Join URL and dial-in
stored per session. Participant report pulls and pre-fills. Attendance
cannot be committed without a facilitator action. A cohort with its own
Zoom credentials uses them."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | All five enforced settings via the Zoom API | 🚩 FLAGGED — 4 of 5 | `lib/zoom/meeting.ts` sends `auto_recording: "none"`, `waiting_room: true`, `join_before_host: false`, and a required password. Screen-share host-only is NOT sent - researched, not guessed: Zoom's meeting-creation API has no documented per-meeting field for it at all, every source treats it as account/user-level only. Not fixable in code - needs Ivan to confirm it's already an account-level default on the real Zoom Healthcare account, or set it there if not (Account Settings → In Meeting (Basic) → Screen Sharing). |
| 2 | Join URL and dial-in stored per session | ✅ PASS | `finalize_cohort_sessions()` writes them per session row; real DB-backed test confirms 3 real rows each carry a distinct value. |
| 3 | Participant report pulls and pre-fills | ✅ PASS | Real Zoom participant-report pull, matched to applicants by email then phone, never auto-commits. |
| 4 | Attendance cannot be committed without a facilitator action | ✅ PASS | `submit_session_log` is `service_role`-only; exactly one application code path calls it, gated by role + ownership check. |
| 5 | A cohort with its own Zoom credentials uses them | ✅ PASS | Real test proves the actual OAuth header sent to Zoom was built from the partner's own credentials, not just that a DB row exists. |

**Closed for now.** Item 1 is the only open item, and it's genuinely Ivan's call, not code - see the question drafted above for how to ask him. Everything else on P3 is a clean pass.

---

## L1: Sign-in — reviewed with Ferenz 2026-09-04/05

Acceptance (verbatim): *"both methods work end to end against real Supabase
Auth. Expired link and wrong code both recover without leaving the screen.
Rate limit message shows the phone number. Grep confirms no password field
exists. Keyboard operable. AAA contrast. 56px primary action."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Both methods work end to end against real Supabase Auth | ⚠️ Amended, now documented | SMS deferred to email-only per Ferenz's own prior instruction (Twilio never configured) - real but previously only recorded in a `lib/copy.ts` comment. 🔧 FIXED: added a proper CLAUDE.md Learned Constraints entry, since it amends Hard Invariant #1 and this file's own workflow rule requires that. Email half confirmed working end to end live (see item 2). |
| 2 | Expired link and wrong code both recover without leaving the screen | 🔧 FIXED (real bug found and closed) | "Wrong code" is N/A under the SMS deferral (no code-entry UI exists). "Expired link" was a REAL bug, found live: clicking an already-used magic link landed on a confusing generic "We couldn't find that" instead of the sign-in screen's own message - Supabase's `/auth/v1/verify` rejects an expired/reused token by redirecting to the project's Site URL with the failure in a URL **hash fragment**, which never reaches `app/auth/callback/route.ts` at all (hash fragments are client-only). Fixed in PR #137: a small client component (`components/auth/auth-hash-error-redirect.tsx`), mounted in the root layout, reads the hash and routes to `/sign-in?error=link_invalid`. Confirmed live end to end by Ferenz after two false starts (a stale/cached preview build, then a browser extension - Cently - actively breaking `window.location`, confirmed by reproducing the exact scenario locally in a clean Playwright browser where it worked correctly) - a real Incognito test with cookies cleared showed the exact correct "That link has expired or was already used. Send a new one below." |
| 3 | Rate limit message shows the phone number | ✅ PASS | Real copy substitution, wired to the actual `rate_limited` branch. |
| 4 | Grep confirms no password field exists | ✅ PASS | Actually run - zero real hits. |
| 5 | Keyboard operable | ✅ PASS | Real `<input>`/`<button>` elements throughout. |
| 6 | AAA contrast | ✅ PASS (spot check) | Shared, measured design tokens system-wide. |
| 7 | 56px primary action | ✅ PASS | `h-14` = 56px. |

**Also found and fixed along the way, unrelated to any single numbered item:** staging's Supabase project had its Auth **Site URL** set to production's own domain (`https://kinkeepers.vercel.app`) - meaning every preview deployment's expired-link error redirect was landing on production, not the preview being tested. Independent of the code fix above, another symptom of the incomplete R1 cutover (staging/production already found to share Zoom credentials too, see X1 above). Ferenz corrected staging's Site URL directly in the dashboard to the stable `main`-branch preview alias, which is what made live-testing this fix possible at all.

**L1 is fully closed.**

---

## X5a: RLS test suite, existing boundaries — reviewed with Ferenz 2026-09-05

Acceptance (verbatim): *"all three boundary categories covered. Each test
demonstrably fails with its policy removed — document that you verified
this per test. Suite runs in CI and blocks merge on failure."* Three
boundaries required: organization isolation, cohort isolation ("a member
of cohort A cannot read cohort B's posts"), role escalation.

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Organization isolation | ✅ PASS | Real JWT-based tests (`referral_intake_schema.sql`); documented drill (policy dropped, 3/10 tests failed exactly as expected, restored). |
| 2 | Cohort isolation | ⚠️ PASS, but not literally "posts" | Real, tested isolation on `cohorts`/`sessions` (`member_identity_bridge.sql`, `cohort_creation_schema.sql`). No `posts`/discussion table exists anywhere in the schema, so the literal wording is structurally unbuildable - satisfied by the closest real adjacent mechanism instead, not a gap this session could have closed. |
| 3 | Role escalation | ✅ PASS | Real tests (`role_escalation.sql`) - a member can't self-promote to admin (grant-level `42501`), partner staff can't re-scope their own org. |
| 4 | Each test demonstrably fails with its policy removed, documented | ✅ PASS | Every relevant file's trailing comment describes a real drill actually run. |
| 5 | Suite runs in CI and blocks merge on failure | ✅ PASS | Confirmed live via the GitHub API - `ci` is a required, admin-enforced status check running `supabase test db` unconditionally on every PR. |

**Clean pass. Nothing fixable, nothing to flag** - item 2's "posts" gap is a real, unbuilt feature (discussion/posts persistence), not a defect.

---

## X2: Program data seeding — reviewed with Ferenz 2026-09-05

Acceptance (verbatim): *"A3's program selector (when built) can show only
licensed programs. Session count comes from the program row with no
hardcoded numbers anywhere. Seeded programs carry no curriculum content —
verified by inspecting program_sessions for null titles."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Program selector shows only licensed programs | ✅ PASS, confirmed live twice | `listLicensedPrograms()` filters `license_status = 'licensed'`, backed by an independent DB-level trigger. Live-confirmed by Ferenz while closing X1 - cohort creation on staging was correctly blocked since zero seeded programs are licensed. |
| 2 | Session count from the program row, no hardcoded numbers | ✅ PASS | Real screens read `program.session_count` throughout. Grep for hardcoded `6`/`9` actually run - every hit is legacy fixture data or a test-fixture literal, never production logic. |
| 3 | Seeded programs carry no curriculum content | ✅ PASS | Real pgTAP assertion: zero `program_sessions` rows have a non-null title/description, run against a real 9-session program specifically. |
| 4 | Four named programs seeded correctly | ✅ PASS | Tele-Savvy, Savvy Caregiver, Powerful Tools, Stress-Busting - session counts match the run doc's own table. |

**Clean pass across the board.**

---

## P6: Consent and legal surfaces — reviewed with Ferenz 2026-09-05/07

Acceptance (verbatim): *"consent captured at enrollment with correct
version. A document version bump prompts re-consent without erasing the
prior record. Consent history retrievable per member. Deletion request
creates an admin queue item."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Consent captured at enrollment with correct version | 🔧 FIXED (real gap found and closed) | `member_consents.ip_hash` — a real column the fuller VERSIONING spec text explicitly requires ("agreed_at, and from what IP hash") — was never populated by `recordConsent()`, always `NULL` on every real row. Fixed by reusing the existing `hashRequestIp()` helper (same pattern `lib/auth/log-sign-in-event.ts` already uses for the identical purpose). `document_type`/`document_version`/`agreed_at`/`member_id` were already correctly captured. |
| 2 | Document version bump prompts re-consent without erasing the prior record | ✅ PASS | Real pgTAP assertion (`consent_and_data_requests.sql`) proves a version bump inserts a new row rather than overwriting the old one - both records remain queryable. |
| 3 | Consent history retrievable per member | ✅ PASS | Real RLS-backed negative test: a member can read their own consent history but not another member's (`consent_and_data_requests.sql`). |
| 4 | Deletion request creates an admin queue item | ✅ PASS | Real DB-backed test proves `member_data_requests` create/read/status-update all work end to end. |

**P6 is closed** on its own literal acceptance line. One adjacent, real gap was found and confirmed live while testing item 1's lifecycle question, but it belongs to **L3's** acceptance criteria, not P6's — P6's own text never mentions cohort-assignment timing, that requirement is L3's ("Presented at enrollment, after cohort assignment, before the first session"). Recorded under L3's entry below rather than counted against P6.
## L2: Referral landing and intake — reviewed with Ferenz 2026-09-05

Acceptance (verbatim): *"partner-scoped link attributes referral source
correctly. Partial intake resumes after a closed tab and after a device
change on the same email. Back navigation preserves everything. 'I'm not
sure' is selectable for stage. Three steps, ten fields, no prohibited
fields collected. AAA contrast, 48px targets, keyboard operable."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Partner-scoped link attributes referral source correctly | ✅ PASS | Real test against a real admin Supabase client. |
| 2 | Partial intake resumes after a closed tab and after a device change | 🔧 FIXED (real gap found and closed) | Mechanism is real and DB-backed (`resume_token`, not localStorage) - genuinely device-independent. But `sendResumeEmail()` had the exact same staging-guard gap already found and fixed in `lib/auth/actions.ts` - zero `assertOutboundMessageAllowed()` check, meaning any real email typed into intake would have received a real resume link on staging, unconditionally. Fixed in PR #142. Confirmed live end to end: Ferenz filled out a fresh throwaway staging preview's intake step 1 with `ferenz@brandlamb.com` (the allowlisted address) and received the real "Continue your KinKeepers application" email with a working resume link. |
| 3 | Back navigation preserves everything | ✅ PASS | Field state independent of `step`; Back only changes the step. |
| 4 | "I'm not sure" is selectable for stage | ✅ PASS | Genuinely wired - `"unsure"` is a first-class DB enum value. |
| 5 | Three steps, ten fields, no prohibited fields collected | ✅ PASS | Exactly 3 steps, 9 fields. Grep for diagnosis/medications/care recipient's name/DOB actually run - zero hits. |
| 6 | AAA contrast, 48px targets, keyboard operable | ✅ PASS (spot check) | Shared components throughout. |

**Also found along the way:** the "main"-branch Vercel git alias (`kinkeepers-git-main-...`) looks like a stable staging preview but is actually a **production**-targeted build (every push to `main` deploys to Production in this project's config) - it shares production's Supabase project and has none of staging's seed data. Corrected mid-session: for any future live test needing a genuine staging-connected preview, use an actual open PR's own branch preview (or a fresh throwaway branch off `main`, deleted after use), never the `main` alias.

**L2 is fully closed.**

---

## L3: Consent, preferences, and account — reviewed with Ferenz 2026-09-07/08

Acceptance (verbatim): *"four separate consents captured with versions. A
version bump prompts re-consent showing what changed, preserving the prior
record. Preference changes take effect on the next reminder. Deletion and
export requests create queue items with on-screen confirmation.
Confidentiality line visible on the discussion screen."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Four separate consents captured with versions | ✅ PASS | `ConsentDocumentSection` renders one section per document, each its own checkbox and its own `recordConsent(documentType, version)` call. |
| 1a | (fuller prompt) "Group confidentiality gets its own screen and its own moment" | 🔧 FIXED | Was a shared intro paragraph on the same `/consent` page as the other three. Split into a dedicated `/consent/confidentiality` screen, reached via a "Continue" action once the first three are agreed; the Discussion screen's confidentiality line now links there directly. |
| 2 | Version bump prompts re-consent, preserving the prior record | ✅ PASS | `getConsentStatus()` keys status by `(document_type, CURRENT version)` - a bump correctly flips status back to pending without touching the prior row (pgTAP-verified under P6). |
| 2a | (fuller prompt) "...showing what changed, in plain language, at the top" | 🔧 FIXED (real gap found and closed) | Nothing anywhere summarized what changed between versions. Added `consent_documents.change_summary` (nullable, placeholder-until-Ivan convention) and wired the consent screen to show it prominently, only on a genuine re-consent (never on a first-time consent). |
| 3 | Preference changes take effect on the next reminder | ✅ PASS | Reminder send path selects `preferred_contact_channel` fresh from the DB at send time, never cached. |
| 4 | Deletion/export requests create queue items with on-screen confirmation | ✅ PASS | Real copy: *"We received your request and will respond within three business days."* Queue creation pgTAP-verified under P6. |
| 5 | Confidentiality line visible on the discussion screen | ✅ PASS | Discussion page links the dedicated confidentiality screen with the exact "quiet line" copy. |
| 6 | Consent presented after cohort assignment, before the first session | 🔧 FIXED (real bug found and closed) | Confirmed live: nothing routed a newly-assigned member to `/consent` at all - signing in after assignment just landed on plain Home. Root cause was two layers deep: `claim_applicant_for_current_user()` only ever matched already-enrolled applicants, so a pre-enrollment sign-in never even resolved to an applicant row; and `getViewer()` never checked consent status at all. Fixed both - see the two entries below. |

**Two real bugs found and fixed alongside item 6, both confirmed live end to end with Playwright against the local stack (real magic-link sign-in via Mailpit, a real admin cohort assignment, real consent submission):**

- `claim_applicant_for_current_user()` (L5's identity bridge) was scoped to `cohort_id is not null and status in ('enrolled', 'attending', 'completed')` - a real `pending_review`/`intake_complete`/`referred` applicant's first sign-in could never resolve to their own applicant row, 404ing before any downstream check ran. Widened to match every status except `declined`/`withdrawn` (which stay deliberately unclaimable - a real negative-test drill confirms this). A new fixture, Dana Whitfield (`pending_review`, no cohort), was added to `seed.sql`/`docs/qa/FIXTURES.md` specifically to make this state testable at all.
- `getViewer()` (`lib/data.ts`) hard-404d a member with no `cohort_id` instead of routing to the existing `/status/[applicantId]` screen, and never checked outstanding consent. Now redirects to `/status/[applicantId]` (no cohort yet) or `/consent` (cohort assigned, consent outstanding) - covering every caller (Home, Discussion, Cohort) from one choke point.

**L3 is fully closed.**

---

## L4: Waitlist and program states — reviewed with Ferenz 2026-09-08

Acceptance (verbatim): *"each state renders correctly and transitions on
real status change. Waitlist names the specific grouping sought. Phone
number visible in waiting and waitlisted states. No gamified completion."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Each state renders correctly | 🔧 FIXED (real gap found and closed) | Waiting-for-review and Assigned-before-session-one both render correctly (e2e-tested). **Program Complete never checked whether a next program actually exists** - it unconditionally rendered "no other program open," even though the prompt's own text requires offering one when it exists. The copy deck's own comment admitted `body_with_next` was never built. Fixed: `getNextLicensedProgramName()` looks for any other currently-licensed program; the screen now branches on whether one was found. Dormant with today's seed data (every program is still unlicensed, per the X2 seed comment) but real and tested. |
| 2 | Transitions on real status change | ✅ PASS | Status reads fresh from the DB on every load; `reopen_applicant()` correctly resets a declined applicant to `pending_review` and clears `decline_reason`. |
| 3 | Waitlist names the specific grouping sought | 🔧 FIXED | `hasMatchingCohort` was hardcoded `true` - re-raised by this audit and reconfirmed directly: a plain existence check (does ANY cohort have real open capacity right now) is a genuine signal, not an auto-matcher, since the actual assignment decision stays 100% a human admin action, unchanged. Deliberately NOT matched against `grouping_description` (that column's own migration comment says it's free text "not derived from relationship/stage values... related but not identical" - never meant to be a match target) and NOT gated on program licensing (real cohorts routinely have no program_id at all - requiring one would make this always false today). `waitlistGroupingLabel`/`meetingTimeLabel` compose from the applicant's own real intake fields, same as before. |
| 4 | Phone number visible in waiting/waitlisted states | 🔧 FIXED | Was reachable only via one click on "Get help now." Now also printed as literal static text directly in both screens' own body, matching CLAUDE.md's stated principle for "locked-out moments." |
| 5 | No gamified completion | ✅ PASS | e2e-verified: no "Congratulations/Certificate/Badge/Achievement," no emoji. |

**Four real gaps closed in total:**
- Program Complete's missing "offer the next program" branch - built and tested, though it can't be observed with real production data until a second program is actually licensed. `complete.body_with_next` copy is drafted, plain functional wording, **not independently confirmed with Ferenz** (unlike `body_no_next`, which was) - worth a real review pass before it ever reaches a real completed member.
- The waitlist grouping/meeting-time labels - built from the applicant's own already-collected intake data.
- `hasMatchingCohort` is now a real, live capacity check, not a hardcoded stub - Waitlisted is genuinely reachable now, for the first time.
- The support phone number now appears as static text on both Waiting-for-review and Waitlisted, not just behind the header button.
- Also refactored `STAGE_OPTIONS`' inline "Early"/"Middle"/"Late" literals (in the intake form) to read from a new shared `COPY.referral.stage_option` map, so the client form and this new server-side composition can't drift the way P3's own time-zone labels once did.

**L4 is fully closed** - all 5 criteria pass, zero open items, zero judgment calls left outstanding.

---

## Remaining sessions — automated first-pass findings, not yet walked through together

The rest of this file is what five parallel research passes plus direct
Vercel/GitHub checks found on 2026-09-04, before Ferenz asked to slow down
and go session-by-session together instead. Kept here as the starting point
for each session's own walkthrough — nothing below has been jointly
confirmed yet, so treat every line as "to verify," not "done."

### F1: Facilitator home and schedule
- Next session, outstanding logs, cohort session position, schedule spanning all cohorts chronologically — PASS.
- Overlap detection is real logic (not a static label) but has **zero automated test coverage**.
- **"Times in the facilitator's own zone" — FAIL.** No facilitator-timezone concept exists anywhere in the schema (`profiles` has no such column); sessions always render in the cohort's own zone, confirmed deliberate ("confirmed with Ferenz to defer rather than invent" per the code's own comment). Root cause shared with A4-cert's own FACILITATOR RECORDS gap below.
- Missing `docs/qa/F1.md` — this session never got a QA doc, unlike its siblings.

### X3: Transactional messages
- Messages 1, 2, 4, 6 — PASS, real triggers, real dedup (real test proves a second identical send is a silent no-op, not a duplicate row), real per-recipient timezone rendering.
- Message 3 (waitlisted) — confirmed still unbuilt, no real trigger exists. Already parked by Ferenz.
- Message 5 (session cancelled) — trigger real, but the body text is missing the "reason" and "next session date" the original message spec calls for.
- Message 6 (program complete) — interpolates the real program name into the body. Borderline against invariant #2 ("nothing about... the program... by name") — a judgment call, not something to silently change.
- Message 7 (sign-in) — confirmed on a separate pipeline (P1's own Supabase Auth delivery), correctly excluded from A5's failure view as already known. SMS template is clean and matches invariant #2's own example. **The magic-link email template has never been customized from Supabase's default** — its literal wording can't be confirmed from the repo.

### X5b: RLS suite completion
Already closed out and merged this session (PR #116) before this audit began — partner scoping, facilitator scoping (including a newly-added "wrong facilitator" negative case), and the required README all real and drilled. Post/discussion isolation remains structurally out of reach (same "no posts table" fact as X5a). Not re-walked in this pass; consider this one settled unless a fresh look turns up something new.

### A4-cert: Facilitator management, certification half
- `facilitator_certifications` schema, assignment-blocking trigger, 60-day expiry warning (real boundary test), capacity view against real seeded data, real admin list+detail+add-certification UI, no payout screen built — PASS.
- Assignment-blocked error message names the specific facilitator and program (not a generic Postgres error) but **by raw UUID, not a human-readable name** — surfaced verbatim to a non-technical admin.
- FACILITATOR RECORDS (profile, contact, status, time zone) from the fuller prompt — deliberately deferred ("confirmed with Ferenz to defer"), same root cause as F1's timezone gap above.

### F2: Session prep and roster (shipped in this repo under the internal label "F3" — the repo's own `F2` is facilitator certification self-view, a different screen not named in the run doc excerpt)
- No member notes field (grep-confirmed, zero hits) — PASS.
- Materials access-control gated by certification, with a real negative-test drill proving an uncertified facilitator is denied — PASS.
- Roster is **missing the `relationship` field** the fuller prompt explicitly requires (column already exists in the schema, just never selected/rendered here); attendance shows as a bare "Attended 2" instead of the doc's own "2 of 4" fraction style.
- **Materials have no actual download mechanism at all** — no Storage bucket, no signed URLs, just a title. "No public URLs" is trivially true only because no URLs of any kind exist yet — the prompt's real intent ("download only") isn't built. A real, scoped feature gap, bigger than a quick fix.

### P7b: Observability completion
Already resolved earlier this session — Sentry/PII-scrubbing (PR1) and uptime monitoring (real UptimeRobot monitor in Ivan's account, verified via real incident history and a real test-alert cycle) both confirmed, documented at `docs/ops/uptime-monitoring.md`. Not re-walked in this pass; consider this one settled.
