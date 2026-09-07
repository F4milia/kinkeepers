# Stream A — strict acceptance-criteria audit tracker

Started 2026-09-04, at Ferenz's direct instruction: re-verify every Stream A
session against its ORIGINAL acceptance criteria (quoted verbatim from
`KINKEEPERS-COMPLETE-RUN-DOC.md`), one session at a time, no partial credit.
A4-payouts and F3 are permanently out of scope — no payment integrations are
being built (see the run doc's own PARKED section, updated the same day).

Mirrors Stream B's own tracker (`docs/qa/STREAM-B-ACCEPTANCE-AUDIT.md`) -
same process, same status key, run in parallel on this repo's other stream.

**Process per session:** pull the literal acceptance line → split into
atomic claims → get real evidence per atom (a live test, a real test run, a
direct grep/config check - never "should work") → fix what's fixable,
record what was done → flag what isn't, with why. This file is the running
record so none of it gets lost between sessions.

**Status key:** ✅ PASS · 🔧 FIXED (this pass) · 🚩 FLAGGED (can't resolve
without Ivan/Ferenz/live access) · ⚠️ DEFERRED (a real, deliberate, already-
decided scope cut - not a gap)

Order matches the run doc's own wave order for Stream A: P1, P2, A1, A2, A3,
P4-pre, P4, P5, A5, L5, X4, R1.

A3 done as of 2026-09-05. P4-pre done as of 2026-09-05. P4 done as of 2026-09-05 (required a 3-PR gap-closure, not just a fix). Remaining: P5, A5, L5, X4, R1.

---

## P1: Passwordless authentication — audited 2026-09-04

Acceptance (verbatim): *"sign in by email link and by SMS code, both end to
end. Session survives a 30-day gap. Sixth code request in an hour is
refused. A consumed magic link fails on reuse. Admin-issued link works and
writes an audit row. No password field exists anywhere in the codebase —
grep to confirm."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Sign in by email link, end to end | 🔧 FIXED | Two real bugs in `supabase/config.toml` were silently breaking every local magic-link sign-in: no `/auth/callback` path in the redirect allowlist (wrong protocol too), and `[auth.email.smtp]` accidentally routing local dev through real Resend instead of Mailpit. Fixed in PR #128, verified end to end with a real Playwright run through the actual `/sign-in` form. |
| 2 | Sign in by SMS code, end to end | ⚠️ DEFERRED, not a gap | Confirmed staging still has a live Twilio integration (a real Twilio API error came back for a test number, not a "provider not configured" error) - but Stream B's own audit of L1 confirms SMS sign-in was deliberately deferred to email-only by Ferenz's own prior instruction, amending Hard Invariant #1. This is leftover configuration from before that decision, not something to chase further. Worth a follow-up: `lib/copy.ts`'s SMS-deferral comment was never promoted to a CLAUDE.md Learned Constraints entry despite amending a Hard Invariant (Stream B's own finding) - that gap belongs to whichever stream owns CLAUDE.md hygiene next. |
| 3 | Session survives a 30-day gap | 🔧 FIXED | Production's Auth session inactivity timeout was still at the Supabase default, never set to 2160 hours (90 days) - staging already had it correct. Ferenz set production directly. PR #131. |
| 4 | Sixth code request in an hour is refused | ✅ PASS | Real test (`lib/auth/rate-limit.test.ts`), confirmed passing on a fresh local reset. |
| 5 | A consumed magic link fails on reuse | ✅ PASS | Proven live: same real emailed link, second click correctly shows "already used," both via the admin-issued `token_hash`/`verifyOtp` path (PR #122's own test) and the self-service PKCE `code` path (verified during this pass). |
| 6 | Admin-issued link works, writes an audit row | ✅ PASS | Fixed earlier this session, PR #122 (the PKCE/implicit-flow mismatch). |
| 7 | No password field anywhere | ✅ PASS | Clean grep, `type="password"` appears nowhere in `app/`, `components/`, `lib/`. |

**Also found, not part of the literal acceptance line:** a `next dev`-only quirk where `/auth/callback`'s computed redirect origin gets normalized to `localhost` regardless of which host the request arrived on, silently dropping the session cookie if a developer mixes `127.0.0.1`/`localhost`. Documented in README, not a code bug (confirmed it doesn't reproduce in a real deployment). A `permission denied for function claim_applicant_for_current_user` error also reproduced locally, initially alarming since the same error appeared in real production logs earlier this session - traced to stale state from `supabase stop`/`start` restoring a Docker backup snapshot rather than replaying migrations; a genuine `db reset --local` made it vanish. Production hasn't shown the error again in the following 12 hours.

**Verdict: two real bugs found and fixed (PR #128, #131), one item correctly deferred (not a gap), rest clean.**

---

## P2: Enrollment and intake (trimmed) — audited 2026-09-04

Acceptance (verbatim): *"referral link and staff form both create records
with correct source attribution. A referral submitted with a
partner_reference_id carries it through to exportable data; a referral
without one works identically; the field never appears in any member-facing
surface — grep to confirm. Partial intake resumes after a closed tab.
Pending applicants are queryable with intake data via the A2 endpoint.
Status transitions write events. Waitlist groups by relationship and stage.
RLS prevents a partner organization from seeing another's referrals — write
the test, authenticate as real users with their own JWTs, never the service
role."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Referral link creates records with correct source attribution | ✅ PASS | Verified live earlier this session (real click-through, `/refer/[slug]` → intake → DB confirmed `referral_source = 'partner_link'`) and by `lib/referral/actions.test.ts`. |
| 2 | Staff form creates records with correct source attribution | 🔧 FIXED | `createStaffReferral()` existed and was fully tested at the action level, but **no UI anywhere called it** - confirmed via `grep`, zero routes reference it, and A1's own nav spec (`lib/admin/nav.ts`) never listed a "Refer someone" item for `partner_staff`. A real navigator had no way to submit a referral at all. Built `app/admin/refer`, wired to the existing action, gated to `partner_staff` (matching the action's own role check). Verified end to end live: signed in as a real `partner_staff` fixture, submitted a referral, confirmed the DB row (`referral_source: 'staff_form'`, correct `partner_reference_id`, scoped to the navigator's own org), followed the resulting resume link to a real, working intake form. |
| 3 | partner_reference_id carries through to exportable data | ✅ PASS | `lib/referral/actions.test.ts` proves it end to end (create → stored → matches on read); A5's partner export (built earlier this session's history) echoes it back per spec. |
| 4 | Referral without partner_reference_id works identically | ✅ PASS | `actions.test.ts`: "works identically without a partner_reference_id." |
| 5 | partner_reference_id never appears in any member-facing surface | ✅ PASS | Grepped every caregiver/applicant-facing directory - the one hit (`start-referral-button.tsx`) only threads it through as a function argument, never renders it. `resolveApplicantByResumeToken()` explicitly strips it (tested). |
| 6 | Partial intake resumes after a closed tab | ✅ PASS | `saveIntakeProgress`/`resolveApplicantByResumeToken` tested directly (`lib/referral/intake-progress.test.ts`); the underlying resume mechanism (a persistent DB row keyed by token, not browser storage) makes "closed tab" not a special case - already exercised via direct DB-state verification earlier this session's intake walkthrough. |
| 7 | Pending applicants queryable via the A2 endpoint | ✅ PASS | A2 (Wave 3) consumes this and its own audit passed - see A2's own section below once reached. |
| 8 | Status transitions write events | ✅ PASS | pgTAP (`referral_intake_schema.sql`) proves the insert-triggers-`referred` and update-triggers-second-event behavior with real triggers, not mocked. |
| 9 | Waitlist groups by relationship and stage | ✅ PASS | Same pgTAP file, `applicant_waitlist_summary` view, correct grouped count, and confirmed to respect the caller's own RLS via `security_invoker` (not a service-role bypass). |
| 10 | RLS prevents cross-partner visibility, real JWTs not service role | ✅ PASS | Same pgTAP file - real authenticated JWTs throughout, plus an actual documented negative-test drill (policy dropped, 3 of 10 assertions correctly failed, policy restored, all 10 passed again) matching CLAUDE.md's own testing-rules requirement exactly. |

**Verdict: one real, significant gap found and fixed (a required UI screen that never got built) - PR #132, merged. Everything else was already correctly built and well-tested.**

---

## A1: Admin shell, roles, and partner organizations — audited 2026-09-04

Acceptance (verbatim): *"three test users, one per persona, each seeing
only their permitted nav and data. Partner A blocked from partner B's data
at the policy level, verified by a test that fails if RLS is removed.
Direct URL access to an unpermitted route returns a refusal, not a blank
page."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Three personas, each seeing only their permitted nav | ✅ PASS | `lib/admin/nav.test.ts` (unit) plus new live e2e coverage (`e2e/admin-role-access.spec.ts`) - real signed-in facilitator/partner_staff/admin sessions, each showing exactly the right nav items in the real rendered app. |
| 2 | Each seeing only their permitted data | ✅ PASS | `partner_cohort_scoping.sql` and `session_attendance.sql` pgTAP suites, both with real authenticated JWTs and a documented negative-test drill (policy dropped, assertions correctly fail, policy restored, all pass again). |
| 3 | Partner A blocked from partner B's data at the policy level, test fails if RLS removed | ✅ PASS | Same two pgTAP files - cohorts, sessions, and attendance all covered, each with its own drop-policy/reset/confirm cycle documented in the file. |
| 4 | Direct URL access to an unpermitted route returns a refusal, not a blank page | 🔧 FIXED (real e2e gap closed) | Unauthenticated case was already covered (`e2e/admin-access.spec.ts`). The **signed-in wrong-role** case had zero browser-driven coverage - that file's own comment named it as out of scope pending real-sign-in Playwright infrastructure, which this session's P1/P2 audit work had since built. Added `e2e/helpers/sign-in.ts` (reusable real magic-link sign-in via Mailpit) and `e2e/admin-role-access.spec.ts`, proving live that a facilitator/partner_staff/member hitting an unpermitted route gets the real refusal screen. |

**Also found and fixed, from the prompt's own body text (not the literal acceptance line):** "Partner staff never see discussion content... say it out loud in the UI" - grepped every admin screen, found this stated nowhere. Added to `AdminShell` (conditional on `partner_staff`), verified live via e2e that it shows for partner_staff and not for admin.

**Also found and fixed, surfaced by building the new e2e test:** `getRequestOrigin()` chose `http`/`https` from `NODE_ENV` alone, which is wrong for a locally-run production build (`next build && next start`, exactly what the e2e `webServer` runs) - production `NODE_ENV` there too, but no TLS. Real sign-in through that build failed with `net::ERR_SSL_PROTOCOL_ERROR`. Fixed to prefer `x-forwarded-proto`, falling back to a host-based localhost check.

**Verdict: isolation and RLS were already excellent. Two real gaps closed (a genuinely untested wrong-role path, and a missing required UI statement), plus one unrelated bug found and fixed along the way. PR #134, merged.**

---

## A2: Intake review and cohort assignment — audited 2026-09-04

Acceptance (verbatim): *"queue ordered oldest first. Cohort meeting times
display in the applicant's zone. Assignment moves status, writes an event,
writes an audit row, and removes the applicant from the queue. Waitlist
groups correctly and the 'ready to open' view returns accurate counts
against seed data. Grep confirms no matching algorithm exists."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Queue ordered oldest first | ✅ PASS | `lib/admin/applicants.test.ts` - real DB rows, older applicant's index confirmed before newer's. |
| 2 | Cohort meeting times display in the applicant's zone | ✅ PASS | `lib/admin/assignment.ts`'s `listOpenCohortsForApplicant`, via `describeCohortMeetingForApplicant`, rendered on the assignment page. |
| 3 | Assignment moves status, writes an event, writes an audit row, removes from queue | ✅ PASS | `applicant_assignment.sql` pgTAP (23 assertions, baseline-delta audit_log pattern) proves status→`enrolled` and the audit row directly; the status-change→event trigger is the same universal mechanism already proven in P2's own audit; removal from the queue follows directly since the queue query filters on `status = 'pending_review'`. |
| 4 | Waitlist groups correctly, "ready to open" view returns accurate counts | ✅ PASS | `lib/admin/waitlist.test.ts` plus P2's own pgTAP coverage of `applicant_waitlist_summary`. The view deliberately shows only a plain count + oldest-wait per group, no invented "ready" threshold - correct per CLAUDE.md invariant #5, not a shortfall (a threshold would itself be the auto-matcher judgment the invariant forbids). |
| 5 | Grep confirms no matching algorithm exists | ✅ PASS | Grepped for match/score/algorithm/recommend/auto-match across `app/`, `lib/`, `components/` - the only hits are comments explicitly rejecting the idea. |

**Also found and fixed, from the prompt's own body text (not the literal acceptance line):** the review queue's required field list ("first name, relationship, care recipient stage, time zone, **availability**, referral source, days waiting") was missing `availability_windows` entirely - a real, correctly-stored column that was never selected or rendered anywhere, on either the queue list or the assignment/detail page. A reviewer had no way to see when an applicant said they were free while judging which cohort's meeting time would actually work for them - the exact mismatch A2's own "6:30 PM Eastern is useless to someone in Honolulu" reasoning was written to prevent, just from the other direction. Fixed by adding the field to the shared types, selecting it in all three query functions, and rendering it on both screens with the intake form's own existing copy (no new copy invented). Verified live: a real applicant with real availability values, confirmed the exact rendered text on both screens via a real signed-in admin session.

**Verdict: one real gap found and fixed (a required review-queue field that was silently never wired up). Everything else - ordering, timezone display, the assignment/audit/event chain, waitlist grouping, and the no-auto-matcher boundary - was already correctly built and well-tested. PR #135, open for review.**

---

## A3: Cohort creation and session scheduling — audited 2026-09-04/05

Acceptance (verbatim): *"creating a cohort produces the correct number of
sessions for the selected program, with Zoom meetings carrying all
enforced settings. Failed Zoom creation leaves the cohort in draft with a
visible error. Rescheduling updates Zoom. A substituted session records
the substitute. Changing programs changes session count with no hardcoded
values anywhere — grep to confirm."*

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Correct number of sessions for the selected program | ✅ PASS | `lib/admin/cohort-creation.test.ts` - session count comes from `program.session_count`, read fresh per call, never hardcoded. |
| 2 | Zoom meetings carry all enforced settings | 🚩 FLAGGED, not a new gap | 4 of 5 (`auto_recording: none`, `waiting_room: true`, `join_before_host: false`, an explicit password) are sent via Zoom's documented meeting-creation API, per `lib/zoom/meeting.ts`. Screen-share-host-only is **not** a per-meeting Create Meeting field per Zoom's own developer forum - already found and documented by Stream B's P3 audit and the 2026-09-03 "Real run doc reconciliation" CLAUDE.md entry. This is not a deliberate scope cut (there is no ⚠️ DEFERRED decision on record for it) - it genuinely can't be resolved by either stream without Ivan confirming the Zoom account's own dashboard-level default, or a live check against real Zoom credentials (none exist anywhere in this project yet, per `lib/zoom/client.test.ts`'s header). Cross-referenced here, not re-flagged as a new finding. **Sent to Ivan for confirmation 2026-09-05** (asked him to check Account Settings → Meeting → "Screen sharing" → Who can share is Host Only, and to set it if it isn't - see the message text in this session's own record) - awaiting his reply as of this writing. |
| 3 | Failed Zoom creation leaves the cohort in draft with a visible error | 🔧 FIXED | Real, current bug: `resolveZoomCredentialsForPartner()` (which calls `getDefaultZoomCredentials()`, throwing synchronously whenever `ZOOM_ACCOUNT_ID`/`ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET` aren't set - a real condition, not hypothetical, matching error text already seen in real `audit_log` rows) was called **outside** `createCohortAction()`'s try/catch. The throw was completely uncaught, crashing the whole Server Action with a generic error page - even though the cohort's own `draft` row had already committed moments earlier, leaving an admin looking at a crash with no way to tell the cohort already existed. Fixed by moving credential resolution inside the try block (`lib/admin/cohort-creation.ts`). Verified live with a real Playwright run against a real admin sign-in with no Zoom credentials configured: the cohort now lands on `/admin/cohorts/[id]` in `draft` status with "Zoom setup failed: Missing Zoom Server-to-Server OAuth credentials..." rendered on the page, no crash. Added a regression test (`lib/admin/cohort-creation.test.ts`, "a missing default Zoom credential is caught, not thrown uncaught") that exercises the exact code path the existing tests never did - every prior Zoom-failure test injects its own `zoomCredentials` override, which bypasses `resolveZoomCredentialsForPartner()`/`getDefaultZoomCredentials()` entirely. |
| 4 | Rescheduling updates Zoom | ✅ PASS | `lib/admin/session-management.test.ts` - updates the Zoom occurrence, notifies members, and does not reschedule the DB row if the Zoom call fails. |
| 5 | A substituted session records the substitute | ✅ PASS | Same file - "records a substitute facilitator without calling Zoom, leaving the cohort's own facilitator untouched." |
| 6 | Changing programs changes session count, no hardcoded values, grep to confirm | ✅ PASS | Clean grep across `app/`, `components/`, `lib/` for a literal session-count number outside of test fixtures/seed data - `program.session_count` and `program.session_duration_minutes` drive both meeting creation and the finalize step. |

**Also found and fixed, from the prompt's own body text (not the literal acceptance line):** the CREATE COHORT form's required field list includes "partner organization (optional)," but `components/admin/cohort-creation-form.tsx` had no field, no state key, and no prop for it at all - despite `createCohortAction`'s `CreateCohortInput.partnerOrganizationId` and `resolveZoomCredentialsForPartner()` being fully built and tested (`lib/admin/cohort-creation.test.ts`: "a cohort assigned to a partner with its own Zoom credentials uses them, not the default account"). The exact same "backend/tests complete, UI never wired" shape as P2's staff-referral screen and A1's discussion-content statement. Fixed by adding a "Partner organization" `<select>` (active partners only, same reasoning as licensed-only programs), wiring `app/admin/cohorts/new/page.tsx` to fetch and pass them. Verified live: selecting a real seeded partner organization correctly stored `partner_organization_id` on the created cohort.

**Note on local testing:** `supabase/seed.sql` deliberately seeds zero `license_status = 'licensed'` programs (accurate real-world state, per that file's own comment - no licensing deal has been signed yet), which made the cohort-creation form entirely unreachable via seed data alone. Verification instead used a temporary, local-only `license_status` flip on one program via the admin client for the duration of each test script, reverted immediately after - never touching staging or production, per the standing test-data rule.

**Verdict: two real bugs found and fixed - a missing required UI field with fully-built/tested backend support, and a serious uncaught-crash bug that could leave an admin unsure whether a cohort was created after a Zoom failure. One item stays 🚩 FLAGGED, carried forward from Stream B's own P3 audit and the 2026-09-03 CLAUDE.md entry rather than re-flagged as new - the screen-share-host-only Zoom setting, sent to Ivan for confirmation 2026-09-05, still awaiting his reply. Reschedule, substitute, and session-count-from-program were already correctly built and well-tested.**

---

## P4-pre: Notification preference migration — audited 2026-09-05

No literal "Acceptance:" line - this is a standalone, migration-only session ("Single migration, nothing else"). Treating its own spec text as the checkable requirement, verbatim: *"the notification-preference column/table that L3 writes and P4 reads. Channel: email, SMS, or both. Default both."*

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Column/table exists, written by L3, read by P4 | ✅ PASS | `applicants.preferred_contact_channel` (`contact_channel` enum: `email`/`sms`/`both`), written by L3's account screen (`lib/account/actions.ts`) and the intake form, read by P4's messaging pipeline (`lib/messaging/session-notifications.ts`, `lib/messaging/applicant-notifications.ts`). |
| 2 | Default both | 🔧 FIXED | Real, current, deliberately-built contradiction: the original migration never set a default on the column, and the intake form's own step-3 contact-preference control is optional - nothing requires a caregiver to touch it before completing intake, and the initial applicant-insert (`lib/referral/actions.ts`) never sets this field at all. Any applicant who never touches that control got `NULL`, not `'both'`. Worse, `lib/messaging/notify-member.ts` then treated that `NULL` as **"email only"** - a documented, deliberate design decision with its own passing test ("defaults to email only when no preference was ever recorded"), directly contradicting both P4-pre's own spec ("Default both") and P4's own body text ("Default to both for the first cohort - we will learn what works"). `supabase/seed.sql`'s fixtures always set this column explicitly, which is why no click-through against seed data ever surfaced it. Fixed with a new migration (`20260905140000_default_contact_channel_both.sql`: sets the column default to `'both'`, backfills existing `NULL` rows, and adds `NOT NULL` so the gap can't recur), plus updated `notify-member.ts`'s defensive null-handling to match the documented default instead of silently diverging from it, and corrected the test that had encoded the wrong behavior (now "defaults to both channels when no preference was ever recorded"). Verified with a new pgTAP assertion (`referral_intake_schema.sql`) proving an applicant insert with no explicit preference gets `'both'` from the column's own default, not from any application-code fallback. |

**Verdict: one real bug found and fixed - the column's stated default was never actually implemented at the DB level, and the application layer had been deliberately, explicitly built and tested to do the opposite of what both P4-pre and P4's own prompt text require. A real caregiver who never touched an optional radio button during intake was silently getting email-only reminders instead of the documented both-channel default.**

---

## P4: Reminders — audited 2026-09-05, gap-closure required

Acceptance (verbatim): *"reminders fire at the right local times for
members in different zones. Duplicate job runs send once. Missed-session
message fires only on a confirmed absence, not an unmarked one. Failed
sends surface in an admin view (A5 renders the queue). Unsubscribe stops
delivery without removing enrollment."*

**Before any fix, none of these atoms could be evaluated as PASS or FAIL
in the ordinary sense - P4's own defining feature, the 24-hours-before /
1-hour-before / missed-session-follow-up schedule, did not exist
anywhere in the codebase.** Every merged P4 PR (`git log`: "generic
outbound-message send mechanism," "wire up Inngest, previously entirely
absent," "session reschedule/cancellation member notifications,"
"per-member timezone," "notification dedup log, admin failure queue, and
unsubscribe") built solid, well-tested infrastructure for a DIFFERENT
feature - A3's reschedule/cancellation notifications - instead of the
reminder schedule P4 itself was scoped to deliver. `lib/inngest/
functions/` contained only a `ping.ts` scaffold explicitly marked "not
wired to any real trigger"; nothing referenced "24 hour," "1 hour," or
queried `session_attendance` for a missed-session trigger anywhere.
Confirmed independently (not just from a research pass) via direct grep
and `git log --all` across every `p4-*` branch.

Built the missing feature as a 3-PR gap-closure, matching the size of a
real session rather than a quick fix:

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Reminders fire at the right local times for members in different zones | 🔧 FIXED | PR1 (#146) added `sessions_due_for_time_reminder(p_window)`, a cron-polled "what's due right now" query; PR2 (#147) added `notifySessionReminder()`, reusing the already-proven `describeInstantForMember` "say both zones" rendering (the same function A3/P4's existing reschedule notifications use, with its own Honolulu/Eastern named-edge-case test). |
| 2 | Duplicate job runs send once | ✅ PASS (mechanism already existed, now actually exercised) | `notification_log`'s real unique `(dedup_key, channel)` index (already proven for reschedule/cancellation) - PR3's own integration test (`lib/inngest/functions/session-reminders.test.ts`) proves a second real tick against the same due session sends zero additional messages, not just that dedup exists in the abstract. |
| 3 | Missed-session message fires only on a confirmed absence, not an unmarked one | 🔧 FIXED | PR1 added `applicants_due_for_missed_session_followup()`, gated by an inner join to `session_attendance` (`status in ('absent','excused')`) - an applicant with no attendance row at all (unmarked) structurally cannot appear in the result set. pgTAP proves this directly (`reminder_due_queries.sql`: "an unmarked... applicant is excluded - confirmed, not assumed"). Fires the calendar day after the session, 8-11am in the cohort's own zone (Postgres `at time zone` date/hour math, not JS). |
| 4 | Failed sends surface in an admin view (A5 renders the queue) | ✅ PASS (unchanged, already correct) | `lib/admin/notifications.ts`'s `listFailedNotifications()` / `/admin/notifications` reads `notification_log` by `status = 'failed'` regardless of `notification_type` - the new reminder/missed-session types appear there automatically, no changes needed. |
| 5 | Unsubscribe stops delivery without removing enrollment | ✅ PASS (unchanged, already correct) | The new functions reuse `listEnrolledMembers`'s `notifications_opted_out = false` filter and `getApplicantContact`'s equivalent single-applicant check - an opted-out applicant simply never appears as a recipient, same proven mechanism as every other message type. |

**Also verified beyond the literal acceptance line (the prompt's own SCHEDULE section):** exactly three message types exist (24h, 1h, missed-session-next-morning) - no sequence, nurture flow, or re-engagement campaign was built, matching "do not build a sequence... these are people in crisis, not leads." Copy uses the run doc's own quoted sample text verbatim ("Your KinKeepers session starts in 1 hour..." / "We missed you Tuesday. The group meets again next week at the same time.") with no health information, no guilt/urgency/streak language, no question demanding a reply - each condition has its own vitest assertion, not just a manual read-through.

**Verdict: P4's own defining feature was never built - three merged infrastructure-only PRs shipped adjacent functionality (A3's reschedule/cancellation notifications) instead. Closed with a 3-PR gap-closure (PR1 #146 schema, PR2 #147 messaging, PR3 the Inngest wiring itself) matching the size of the missing work, not a quick patch. Every literal acceptance atom and every SCHEDULE-section requirement is now real, tested code - not assumed from adjacent, similar-sounding infrastructure.**
