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

## Remaining sessions — automated first-pass findings, not yet walked through together

The rest of this file is what five parallel research passes plus direct
Vercel/GitHub checks found on 2026-09-04, before Ferenz asked to slow down
and go session-by-session together instead. Kept here as the starting point
for each session's own walkthrough — nothing below has been jointly
confirmed yet, so treat every line as "to verify," not "done."

### X5a: RLS test suite, existing boundaries
- Organization isolation, role escalation — PASS, real JWT-based negative-drill tests.
- Cohort isolation — PASS via cohorts/sessions RLS, but the literal "cannot read cohort B's **posts**" wording is unbuildable as stated: no posts/discussion table exists anywhere in the schema. Satisfied by an adjacent real mechanism, not literally "posts."
- CI blocks merge on failure — PASS, confirmed live via `gh api` branch-protection query (`ci` is a required, admin-enforced check).

### X2: Program data seeding
- Clean pass on every criterion, including the explicit "grep for hardcoded session counts" check (actually run — zero production violations, only legacy fixtures/test literals).

### L2: Referral landing and intake
- Partner-scoped referral attribution, back-navigation, "I'm not sure," 3 steps/9 fields, no prohibited fields — PASS.
- Cross-device resume (via emailed resume link, not localStorage) — mechanism is real and correctly DB-backed, but `send-resume-email.ts` carries a stale comment claiming `RESEND_API_KEY` was "never configured," contradicted elsewhere in the codebase. No test confirms a real send occurs.

### P6: Consent and legal surfaces
- Version bump preserves prior record, consent history retrievable, deletion request creates admin queue item — PASS.
- **`member_consents.ip_hash` column exists but is never populated** — `recordConsent()` never wires it in, despite the acceptance text explicitly requiring "from what IP hash," and a working `hashRequestIp()` helper already used elsewhere in the codebase.
- Whether consent is presented at the *correct lifecycle moment* (not just that `/consent` is reachable) is NEEDS-LIVE-VERIFICATION.

### L3: Consent, preferences, and account
- Four consents with own checkboxes, preference-takes-effect-on-next-reminder, deletion/export on-screen confirmation, confidentiality line on discussion screen — PASS.
- **Re-consent flow never shows "what changed, in plain language, at the top"** on a version bump — a distinct requirement from the original prompt, genuinely absent from the UI and the copy deck. Needs real per-version change-summary content — a copy/product decision, not something to invent.

### L4: Waitlist and program states
- All four states are coded and do branch on real DB status — PASS mechanically.
- **`hasMatchingCohort` is hardcoded `true`** for every real applicant (confirmed with Ferenz previously, per the code's own comment) — the Waitlisted state is structurally unreachable in production as a result, since computing a real "matching cohort" signal would require the auto-matcher invariant #5 forbids. Known, deliberate tradeoff; flagging for the record against this literal audit.
- **Phone number is not literally rendered as visible text** in the waiting/waitlisted states' own copy — only reachable via an extra click through the generic support sheet, despite "Offer the 800 number" being explicit, state-specific prompt text.
- No gamified completion — PASS.

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
