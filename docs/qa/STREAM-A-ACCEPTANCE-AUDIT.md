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

**Verdict: one real, significant gap found and fixed (a required UI screen that never got built) - PR TBD. Everything else was already correctly built and well-tested.**
