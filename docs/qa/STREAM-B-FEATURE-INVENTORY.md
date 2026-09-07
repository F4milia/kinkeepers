# Stream B — feature inventory (handoff)

Written 2026-09-08 for handoff to Ivan / a new developer, alongside Stream
A's own equivalent inventory. Summarizes every Stream B session's real,
current state — not what was originally planned, what's actually true in
the codebase today, verified against `KINKEEPERS-COMPLETE-RUN-DOC.md`'s
own literal acceptance criteria, one session at a time, no partial credit.

Full detail, evidence, and file references for every line below live in
`docs/qa/STREAM-B-ACCEPTANCE-AUDIT.md` — this doc is the short version.

**Out of scope, permanently:** A4-payouts and F3 (payout display) — no
payment integrations are being built for this app at all.

---

## Fully audited and closed (10 of 16 sessions)

These were walked through side-by-side against their original acceptance
text and closed. Nothing below is "probably fine" — every line was
checked against real code, a real test, or a real live deployment.

| Session | What it is | Status |
|---|---|---|
| **X1** | Staging environment | Closed. One real thing needs Ivan: staging and production still share the same Zoom Server-to-Server OAuth app — needs a second real Zoom credential set provisioned. Not fixable in code. |
| **P7a** | Audit log + structured logging | Closed, clean pass. |
| **P3** | Zoom for Healthcare integration | Closed. One real thing needs Ivan: "screen share: host-only" can't be set per-meeting via Zoom's API at all (researched, not guessed — Zoom has no such field) — needs Ivan to confirm/set it as an account-level default on the real Zoom Healthcare account. |
| **L1** | Sign-in (magic link + SMS) | Closed. SMS is deliberately deferred to email-only (Twilio never configured, Ferenz's own prior instruction — this amends Hard Invariant #1, now properly recorded in CLAUDE.md). One real bug found and fixed: an already-used magic link landed on a confusing generic error instead of "link expired" — Supabase's failure mode uses a URL hash fragment the app never read. |
| **X5a** | RLS test suite (existing boundaries) | Closed, clean pass. One structural note: "cohort isolation... can't read cohort B's posts" is untestable literally — no posts/discussion table exists in the schema at all (a real, known gap, not a defect in this session). |
| **X2** | Program data seeding | Closed, clean pass. Zero programs are seeded as `licensed` — deliberate, since no program's real commercial terms are settled yet. |
| **P6** | Consent and legal surfaces (schema/versioning) | Closed. One real bug found and fixed: `member_consents.ip_hash` was a real required column, never actually populated. |
| **L2** | Referral landing and intake | Closed. One real bug found and fixed: the cross-device intake-resume email had zero staging-safety guard — any real email typed into intake on staging would have received a real email. |
| **L3** | Consent, preferences, and account (the actual screens) | Closed. Two real bugs found and fixed: (1) nothing ever routed a newly-assigned member to the consent screen at all — traced two layers deep to a member-identity function that only recognized already-enrolled applicants; (2) group confidentiality never got its own screen, and a version bump never showed what changed, both required by the original spec. |
| **L4** | Waitlist and program states | Closed, all 5 criteria pass. Four real gaps found and fixed: Program Complete never offered a next program even when one exists; the waitlist screen's "what you're looking for" labels were never wired; the waitlist state itself was permanently unreachable (hardcoded stub, now a real capacity check); the support phone number wasn't visible as static text on two states the spec explicitly named. |

## Not yet jointly reviewed (6 of 16 sessions)

These have only had an automated first-pass look, not the same
side-by-side rigor as the ten above. Real, load-bearing findings already
surfaced; the process just hasn't reached them yet in order.

| Session | What it is | What the first pass already found |
|---|---|---|
| **F1** | Facilitator home and schedule | Core screens pass. Overlap detection (does a facilitator have two sessions at once) is real logic with zero test coverage. "Times in the facilitator's own zone" is unbuilt — no facilitator-timezone column exists anywhere in the schema, confirmed deliberate. Missing its own QA doc. |
| **X3** | Transactional messages (7 total) | 4 of 7 pass cleanly with real dedup. Message 3 (waitlisted) is confirmed unbuilt, already parked. Message 5 (session cancelled) is missing the reason/next-date text the spec calls for. Message 6 interpolates the real program name — a borderline call against the no-program-details-in-messages invariant. The real sign-in magic-link email has never been customized from Supabase's own default template. |
| **X5b** | RLS suite completion | Already closed and merged (PR #116) before this audit started — partner scoping, facilitator scoping, real negative-test drills. Considered settled. |
| **A4-cert** | Facilitator certification enforcement | Schema, assignment-blocking, 60-day expiry warning, admin UI all real and tested. One real UX gap: the "certification expired" error names the facilitator/program by raw UUID, not a human-readable name. Facilitator profile fields (contact, status, time zone) deliberately deferred. |
| **F2** (shipped internally as "F3") | Session prep and roster | Materials access-control correctly gated by certification with a real negative test. Two real gaps: roster is missing the `relationship` field the spec requires (column exists, just never selected), and materials have no actual file-download mechanism at all — just a title, no Storage bucket, no signed URLs. |
| **P7b** | Sentry/PII-scrubbing + uptime monitoring | Already resolved earlier this session — both halves confirmed real (a live UptimeRobot monitor in Ivan's own account, verified against real incident history). Considered settled. |

## The shape of what's actually risky here

Nearly every real bug found in the ten closed sessions was the same two
shapes, repeatedly:
1. **A staging-safety guard that existed for one send path but not
   another** — `assertOutboundMessageAllowed()` protected the messaging
   module directly, but `signInWithOtp()` and the intake-resume email
   both called their provider (Supabase Auth / Resend) directly,
   bypassing it entirely. Worth grepping for any OTHER real outbound
   send that might have the same gap before this ships.
2. **A real function's own scope was narrower than a later feature
   needed**, and nothing ever came back to widen it — `getViewer()`
   never checked consent; `claim_applicant_for_current_user()` only
   matched enrolled applicants; `hasMatchingCohort` was left a
   permanent stub. Each was individually reasonable when written, and
   each quietly blocked the feature built on top of it until this
   audit caught it live.

## Standing decisions still open, not code

- **Ivan**: a second real Zoom OAuth app for staging (X1); confirm
  screen-share host-only is an account-level default (P3).
- **Product**: whether F1/A4-cert's facilitator-timezone gap is worth
  building now; F2's materials-download mechanism is a real, scoped
  feature, not a quick fix.
- **Copy review**: L4's `body_with_next` (Program Complete) and L3's
  version-bump change-summary mechanism both ship with drafted, plain
  functional placeholder text — neither independently confirmed with
  Ferenz the way most of this app's other copy was.
