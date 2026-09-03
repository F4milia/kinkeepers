# **KinKeepers — Complete Run Doc (Prompts Included)**

**Executor:** Ferenz Panisan | **Owner:** Ivan Rattliff **This document replaces** the sequencing sections of kinkeepers-prelaunch-backend.md, kinkeepers-admin-prompts.md, and the launch completion track, **and contains the full prompt text for every session** with all amendments already merged in. Ferenz runs from this doc alone. Do not also paste from the source PDFs — that reintroduces the un-amended versions.

**Merged amendments** (already integrated below, listed for Ivan's review): X1 prerequisites corrected and moved to Wave 0 · P7 split into P7a/P7b · P2 trimmed (review-queue UI removed, moved to A2) and `partner_reference_id` added · P4 preceded by a standalone preference-column migration · X5 split into X5a/X5b · A4 split into A4-cert / A4-payouts (payouts parked) · A5 export carries the partner reference ID · F3 parked with A4-payouts.

---

## **Standing preamble — paste above every session prompt**

```
STANDING PREAMBLE (applies to this and every session)

1. FIRST OUTPUT, before any code: a PR plan — an ordered list of PRs
   for this session, each under 200 lines, each independently
   mergeable and passing CI on its own. Then execute PR by PR in
   that order. If mid-session the plan needs to change, restate the
   remaining plan before continuing.
2. Per PR: write tests first against the acceptance criteria,
   implement, run the tests, self-correct until green, then open the
   PR.
3. Modify only files within this session's scope. If you need to
   touch a file outside it — especially migrations, auth, RLS, Zoom
   settings, or another session's surface — STOP and report which
   file and why. Do not proceed.
4. Every PR description lists: (a) every file modified, (b) any
   acceptance criterion not satisfied and why, (c) any assumption
   made that the prompt did not specify.
5. On merge, the reviewer tags the PR `clean` or `rework`. Nothing
   else — this is the week-one data that makes every estimate real.
```

---

## **How to run this**

Two Claude Code sessions in parallel, one per git worktree:

```
claude -w stream-a        # critical path
claude -w stream-b        # parallel track
```

**Stagger, don't synchronize.** Launch Stream B a half-day behind Stream A so one stream's PR review window overlaps the other's generation time.

**Daily rhythm:** review and merge both streams' open PRs before the 09:30 demo. Relaunch both streams after. Per stream: PRs under 200 lines, branches under 24 hours, 2-hour push cadence.

**Review tiers:** CodeRabbit-only PRs merge on Ferenz's 2-minute pass at any time. Greptile-tier PRs (pre-flight glob list) get the session's named edge case verified by hand and merge at the 09:30 window with Ivan present. In Waves 0–4 most Stream A PRs are Greptile-tier — correct, not noise.

**Migration rule — non-negotiable:** any PR containing a database migration merges same-day, and the other stream rebases before its next push.

**Learning loop:** every `rework` tag gets a one-line root cause added to CLAUDE.md before the next session launches — what bounced and why. Same for any discovered constraint or hidden coupling. This is the only mechanism that makes week four smarter than week one; a rework without a CLAUDE.md line is a lesson paid for twice.

**Wave 1 retro — scheduled, not intended:** at the end of Wave 1, a fixed 30-minute checkpoint: read the clean/rework tags, compute actual cycle time per PR, and deliberately re-decide stream count, prep depth, and the Greptile glob list against measured numbers. Every estimate in this doc is constructed, not measured — this is where it gets corrected.

**Copy deck rule:** every session that adds UI strings (L1–L4, X3) runs on Stream B, sequentially. New copy strings go in the Part 3.1 copy deck, never inline. If a session needs a string that isn't in the deck, add it there first.

**Rules for every session** (from the admin doc, applying globally):

* Every mutation writes to the audit log from P7a. No exceptions, no "minor" changes.
* Every destructive action confirms, and the confirm dialog names what will happen.
* The /admin layout density exemption applies to admin screens only. It does not leak into caregiver screens.
* Role is resolved server-side from the database. Never from a client claim.
* Frontend design constraints (18px base, 48px targets, AAA contrast, no time-based interactions, no invented copy, no cheerfulness) apply to every member/facilitator screen without exception. Re-read frontend-build Part 1.2 before each UI session.

---

## **Pre-flight (before any Wave 0 session launches)**

Thirty minutes of config, done once. Not Claude Code sessions.

1. **Greptile trigger paths** — replace the F4milia-shaped list:

```
supabase/migrations/**
lib/auth/**
**/rls*
**/zoom/**
**/reminders/**   (or **/messaging/** — match the dir P4/X3 create)
**/consent/**
**/audit/**
app/admin/partners/**   (update glob when A1 merges)
```

No Stripe globs until A4-payouts unparks — there is no Stripe path in this build yet.

2. **ZeroStep path filter** — condition the Playwright job on `app/**` and `components/**`. Backend-only PRs must not wait on browser tests. pgTAP stays unconditional on every PR.

3. **Worktrees** — create `stream-a` and `stream-b`, name the terminal panes, confirm both see CLAUDE.md.

4. **Companion docs in repo** — confirm CLAUDE.md, kinkeepers-frontend-build.md, f4milia-master-sequence.md, and f4milia-revenue-model.md exist in the repo the worktrees check out. A prompt whose required reading is missing produces a session that invents the constraints.

---

## **Wave table**

| Wave | Stream A (critical path) | Stream B | Gate / notes |
| ----- | ----- | ----- | ----- |
| 0 | P1 auth | X1 staging, then P7a audit + logs | P7a merges before P1 reaches the admin-link step |
| 1 | P2 enrollment (trimmed) | P3 Zoom | No shared files |
| 2 | A1 shell, roles, partners | L1 sign-in, then X5a RLS suite | L1 needs only P1 + staging |
| 3 | A2 intake review | X2 programs, then L2 referral + intake | X2 must merge before Wave 4 opens |
| 4 | A3 cohort creation (1–1.5 wks) | P6 consent mechanics | A3 consumes P3 + X2 + A1 |
| 5 | P4 reminders | L3 consent, prefs, account | Preference-column migration lands first |
| 6 | P5 instrumentation | L4 states, then F1 facilitator home | Stream B stays in pure-UI files this wave |
| 7 | A5 oversight + partner reports | X3 transactional messages | X3 trails P4, never beside it |
| 8 | L5 API integration | X5b, then A4-cert | L5 owns the member data layer this wave |
| 9 | X4 dial-in identity | F2 prep + roster, then P7b | F2 needs A4-cert merged |
| 10 | R1 deploy pipeline + rollback runbook | — | R1 completes before cohort one's first live session |
| — | *Parked:* A4-payouts, F3 |  | Blocked on B1/B3 — confirm status by end of Wave 5 |

**Launch gates.** *Minimum enrollable* (end of Wave 5 + X3): a real caregiver can be referred, complete intake, consent, be assigned, and receive reminders with working Zoom links; in-app cohort screens still on fixtures, acceptable for cohort one watched by hand. *Full member experience* (end of Wave 8): fixtures gone, RLS suite complete. Cohort one can start between the gates.

**Review tier per session.** Routing is automatic — CI matches changed files against the pre-flight glob list; nobody tags PRs by hand. This table is just so Ferenz knows which sessions to expect the slower 09:30 human-verified merge on, and why. "Greptile" = trips the high-stakes globs, gets the named-edge-case check with Ivan present. "CodeRabbit" = merges on the 2-minute pass. CodeRabbit runs on every PR regardless; the column shows whether Greptile *also* fires. A session can produce both PR types across its lifetime — the tag is the dominant one.

| Session | Tier | Why |
| ----- | ----- | ----- |
| P1 auth | **Greptile** | `lib/auth/**`, sessions, token handling |
| X1 staging | CodeRabbit | infra/config, no policy surface |
| P7a audit + logs | **Greptile** | `**/audit/**` — the log every reviewer reads |
| P2 enrollment | **Greptile** | migrations + partner-referral RLS |
| P3 Zoom | **Greptile** | `**/zoom/**` — the five enforced settings |
| A1 shell + partners | **Greptile** | partner-org RLS, `app/admin/partners/**` |
| L1 sign-in | CodeRabbit | UI over P1's endpoints; no new policy |
| X5a RLS suite | **Greptile** | it *is* the isolation layer |
| A2 intake review | **Greptile** | assignment writes, status/event integrity |
| X2 programs | **Greptile** | migration + license-gating enforcement |
| L2 referral + intake | CodeRabbit | UI; RLS already proven in P2 |
| A3 cohort creation | **Greptile** | `**/zoom/**` again + scheduling migration |
| P6 consent | **Greptile** | `**/consent/**` — versioning integrity |
| P4-pre pref migration | **Greptile** | migration (tiny, but it's schema) |
| P4 reminders | **Greptile** | `**/reminders/**` — no-PHI content rule |
| L3 consent/prefs/account | CodeRabbit | UI; consent logic lives in P6 |
| P5 instrumentation | **Greptile** | edits trigger points across P2/P3/A2/A3 |
| L4 state screens | CodeRabbit | pure UI |
| F1 facilitator home | CodeRabbit | UI over existing endpoints |
| A5 oversight + reports | **Greptile** | partner-scope + no-path-to-post-content |
| X3 transactional msgs | **Greptile** | `**/messaging/**` — no-PHI content rule |
| L5 API integration | **Greptile** | rewires the entire member data layer |
| X5b RLS completion | **Greptile** | partner/facilitator/post-content boundaries |
| A4-cert | **Greptile** | cert-gated assignment enforcement + migration |
| X4 dial-in identity | **Greptile** | feeds attendance → payout; PII matching |
| F2 prep + roster | **Greptile** | materials access-control by certification |
| P7b Sentry/uptime | **Greptile** | PII scrubbing must be verified, not assumed |
| A4-payouts *(parked)* | **Greptile** | payout calculation integrity |
| F3 *(parked)* | **Greptile** | payout display integrity |

Most of the build is Greptile-tier — which is expected for a product whose entire moat is data-isolation and compliance boundaries, and is why the two-reviewer question (James on Stream B) is worth settling early. The CodeRabbit-only sessions cluster on the L-track and F1: pure UI over endpoints whose policies were already proven upstream. Those are the ones that keep the streams moving at the 2-minute merge; the Greptile-tier ones are why the 09:30 window exists.

---

## **Named edge-case register**

One per session — the check the human reviewer executes by hand before merging, chosen because the automated gates structurally can't catch it. This is the "session's named edge case" the review-tier rule refers to.

| Session | Edge case to verify by hand | Why the gates miss it |
| ----- | ----- | ----- |
| P1 | Issue an admin one-time link, then have the member request their own SMS code before using it; use both — each single-use, both audited | Two live credentials for one member is a path no single-flow test exercises |
| X1 | Run the reset command twice back-to-back — seed intact, no duplicate or orphan rows | Idempotency of ops tooling isn't covered by product tests |
| P7a | Force an audit insert to fail during a mutation — the mutation rolls back | Gates test that audit rows appear, not that mutations die without them |
| P2 | Refer the same caregiver via the partner link AND the staff form — two pending records, correct sources, both queryable | Dedup behavior is a product decision no test asserts unless named |
| P3 | Create a cohort on partner-supplied Zoom credentials — all five enforced settings verified on THEIR instance | The video_provider branch is the rarely-exercised path |
| A1 | Demote a signed-in facilitator to member — their next request loses /admin without waiting for token expiry | Mid-session role change tests DB-resolution, not the happy path |
| L1 | Sign in with a plus-tag variant (ivan+test@) of an existing address — treated as new, routed to intake | Address-normalization edge auth tests skip |
| X5a | Point the suite at the service-role key on purpose — it must FAIL loudly | Guards the guard: a suite quietly on service role passes everything |
| A2 | Applicant in Honolulu, cohort in Eastern, across a DST-change week — both renderings correct | Timezone tests rarely cross DST |
| X2 | Flip a program licensed → in_negotiation — new cohort creation blocked, active cohorts untouched | State transition after the selector test already passed |
| L2 | Close the tab mid-step-2, resume on a different device with the same email — values intact, "We saved your answers" | Cross-device resume is beyond a single-browser E2E |
| A3 | Kill the Zoom API at meeting 4 of 6 during creation — cohort lands in draft, error names the failure, zero half-scheduled sessions | Partial external failure mid-loop is exactly what mocks hide |
| P6 | Bump a document version while a member is mid-consent (2 of 4 agreed) — no mixed-version record | Concurrency between the consent flow and versioning |
| P4 | Reschedule a session after its 24h reminder sent — the 1h reminder carries the NEW time; nothing fires for the old slot | Event-ordering across A3 and P4 |
| L3 | Member texts STOP, then re-enables SMS in preferences — behavior defined and honest, enrollment intact | Provider-level suppression vs our preference is cross-system |
| P5 | Cancel a session — zero session_missed rows; retention views exclude it | The "our failure, not theirs" rule spans A3 and P5 |
| L4 | Decline an applicant, then re-open them — member view returns to waiting-for-review, no stale decline copy | Reversal paths aren't in the happy-path E2E |
| F1 | A substituted session renders correctly to BOTH facilitators — original sees it covered, substitute sees it scheduled | Two-viewer consistency for one row |
| A5 | Correct attendance on a session already inside a payout calculation — prior value preserved, payout NOT silently recomputed | The stored-inputs rule crosses attendance and payouts |
| X3 | Assign a member, reschedule before the welcome sends — welcome carries the new time, exactly one welcome | Idempotency under racing events |
| L5 | Load the app, switch to airplane mode, reopen — next-session details render from cache with dial-in visible | Offline behavior needs a hand on a real device |
| X5b | Transfer a referred caregiver to a new cohort — partner visibility follows; the old cohort drops from partner view if no referrals remain | Scope recomputation on membership change |
| A4-cert | Expire a certification mid-cohort in seed — existing assignment stands, NEW assignment blocked, the 60-day warning fired earlier | Temporal boundary between the two enforcement points |
| X4 | Two members of one cohort share a phone number — the call surfaces as ambiguous, never auto-attributed to either | A uniqueness assumption the matcher would otherwise make silently |
| F2 | Withdraw a member mid-program — roster reflects it, attendance history preserved | Departed-member state on a live roster |
| P7b | Throw the fake-PII test error from inside an Inngest job, not a request — still scrubbed | Background-context scrubbing differs from request-context |
| R1 | Roll back a migration in staging with seeded data present — data intact, app healthy | Down-paths are never exercised until the night they're needed |

**If a stream stalls:** fix-forward on the stalled stream; the other continues. No third worktree. Both stalled at once = ticket-prep signal — raise at 09:30.

---

---

# **WAVE 0**

## **Stream A — P1: Passwordless authentication**

```
Read CLAUDE.md before starting.

AMENDMENT: audit rows for admin-issued sign-in links write to the P7a audit
table. If P7a has not merged when you reach that step, stop and wait rather
than creating a parallel audit structure.

Build authentication using Supabase Auth. Passwordless only.

WHO IS LOGGING IN
Caregivers aged 50-75, often exhausted, often with presbyopia or tremor,
sometimes using a tablet a family member set up. Some are visually impaired.
This drives every decision below.

NO PASSWORDS. Not as an option, not as a fallback, not behind a toggle.
Password reset flows are where this demographic abandons, and a forgotten
password on the night someone needs the group is a retention failure we
control.

TWO METHODS, MEMBER CHOOSES
1. Email magic link (default) — one tap, no code to transcribe
2. SMS six-digit code (alternative) — read and typed on the same device

Offer both at sign-in. Some members read texts more reliably than email;
others can't type six digits comfortably. Do not pick for them.

DELIVERY
- Email via Resend (already in the stack). Custom SMTP in Supabase Auth.
- SMS via Twilio. Custom SMS provider in Supabase Auth.
- Message content carries NO health information and no program
  description. "Your KinKeepers sign-in code is 123456" and nothing more.
  Assume the message may be read by someone other than the recipient.

SESSIONS
- 90-day sessions with rolling refresh on activity. Re-authenticating
  every visit is a retention leak, not a security win.
- Refresh token rotation on.
- No forced re-auth except on explicit sign-out or an admin revocation.

RATE LIMITING AND ABUSE
- Max 5 code requests per identifier per hour, 15 per day.
- Codes expire in 15 minutes. Magic links in 60 minutes — older users
  check email less often and a 15-minute link will strand them.
- Single-use enforcement. A consumed token is dead.
- Log every attempt: identifier, method, outcome, IP hash.

HUMAN RECOVERY PATH — required, not optional
When someone cannot get in, the answer is a phone number, not a self-serve
flow.

Build an admin action that lets a verified staff member issue a one-time
sign-in link for a member after identity verification by phone. Every use
writes an audit record: who issued it, for whom, when, and a free-text
reason. This is a privileged action — restrict it to the admin role and
surface it in an audit log an outside reviewer could read.

ROLES
Map to the existing four-role model. A member's role and cohort assignment
come from the database, never from a claim the client can set.

Acceptance: sign in by email link and by SMS code, both end to end. Session
survives a 30-day gap. Sixth code request in an hour is refused. A consumed
magic link fails on reuse. Admin-issued link works and writes an audit row.
No password field exists anywhere in the codebase — grep to confirm.

Commit: "feat: passwordless authentication"
```

## **Stream B — X1: Staging environment**

```
Read CLAUDE.md before starting.

AMENDMENT: Prerequisites are phases 0-5 only — NOT P1-P7/A1-A5. Build the
environment and a minimal seed now (partner organizations, members, cohorts
at lifecycle stages). The richer seed described below (attendance history,
six facilitators) grows incrementally: extend the seed script in the same PR
as each feature that needs it. The one-command reset and the
no-real-messages guarantee are unchanged and are the acceptance criteria
that matter today.

Build a staging environment. Do this before any other session — everything
else needs somewhere safe to be verified.

- Separate Supabase project, separate database, separate Zoom app
  credentials, separate Twilio and Resend keys
- Seeded with realistic fake data, growing to: 3 partner organizations,
  4 cohorts at different lifecycle stages, 30 members, 6 facilitators,
  attendance history across completed sessions
- Staging must NEVER send real messages. Twilio and Resend in test mode,
  or an outbound allowlist restricted to team addresses. A staging
  reminder reaching a real caregiver is a trust failure we cannot undo.
- Zoom meetings in staging use a separate app with recording disabled at
  account level, same as production
- A one-command reset that drops and reseeds

Environment parity matters more than usual here. A health system will
eventually want us to demo against staging, and a staging environment that
behaves differently from production produces false confidence in exactly
the review that matters.

Document in the repo README: what's different between staging and
production, and what cannot be tested in staging.

Acceptance: staging deploys independently. Seed produces a browsable
multi-cohort program. A reminder job in staging sends nothing outbound —
verified by checking provider logs, not by assuming. Reset works.

Commit: "chore: staging environment and seed"
```

## **Stream B (second session) — P7a: Audit log and structured logging**

```
Read CLAUDE.md before starting.

AMENDMENT: this is the first half of the original P7. Build ONLY what is
below. Sentry, uptime monitoring, and alerting are P7b in Wave 9.

ADMIN AUDIT LOG
Every privileged action — admin-issued sign-in links, cohort assignments,
attendance edits, deletion fulfillment — in one append-only log a reviewer
could read without a walkthrough. A health system security review will ask
for exactly this. Every later session writes into this table.

STRUCTURED LOGS
Auth attempts, enrollment transitions, consent captures, reminder sends,
attendance commits, admin privileged actions.
Log identifiers, never content. Never a post body, never intake free text.

HEALTH CHECK
An endpoint that verifies database connectivity, auth provider
reachability, and Zoom API reachability. (Uptime monitoring hits it in
P7b.)

Acceptance: audit log is append-only and captures all five privileged
action types with actor, action, subject, timestamp. Structured logs
contain identifiers only — verified by inspecting output for a seeded
flow. Health check correctly reports a degraded dependency.

Commit: "feat: audit log and structured logging"
```

---

# **WAVE 1**

## **Stream A — P2: Enrollment and intake (trimmed)**

```
Read CLAUDE.md before starting.

AMENDMENT: Build referral capture (both paths), the intake schema and
partial-save behavior, the full status model and event log, and waitlist
logic. DO NOT build the review-queue screen or the assignment UI — A2 owns
those screens in Wave 3. The queue exists here as data and endpoints only.

There is currently no way for a person to get in. This session builds the
top of funnel.

REFERRAL CAPTURE
A care navigator at a partner organization needs a way to refer someone.
Build both paths:
1. A shareable referral link, scoped per partner organization, that the
   caregiver themselves completes.
2. A staff-facing form where a navigator submits on the caregiver's behalf.

Referral source must be recorded on every record. Partners will ask how
many of their referrals enrolled, and that number is our best renewal
argument.

PARTNER REFERENCE ID (addition)
Referrals accept an optional partner_reference_id: an opaque string, max
64 characters, supplied by the partner on either referral path. We store
it, never parse or interpret it, never display it to members, and echo it
back in the partner attendance/delivery export (A5 consumes it). It exists
so a partner can join our delivery evidence to their own beneficiary
records on their side — we hold no beneficiary identifier, and the
DO-NOT-COLLECT list below is unchanged. RLS: the field is visible only to
the referring partner organization and internal admin.

INTAKE
Fields: first name, last name, email, phone, time zone, relationship to
the person they care for, that person's stage (early / middle / late /
unsure), availability windows, preferred contact channel.

Ten fields maximum. Every additional field costs completions from an
exhausted person. Save partial progress — this population gets interrupted
constantly and a lost form is a lost enrollment.

Do NOT collect: diagnosis details, medications, the care recipient's name,
date of birth, or any beneficiary identifier. We do not need them and
holding them changes our compliance posture.

SCREENING DATA (no UI this session)
Intake creates a record in `pending` status. It does NOT auto-assign to a
cohort. Expose pending applicants with their intake data via the endpoint
A2 will consume. Do not build the review screen.

Relationship-and-stage matching is our core differentiator and it is a
human judgment. Do not build an auto-matcher.

WAITLIST
When no matching cohort is open, the applicant goes to a waitlist tagged
by relationship and stage. Build the data and query that answer "how many
people are waiting who would fit a new cohort of X" — A2 renders it.

STATUS MODEL
referred → intake_complete → pending_review → enrolled → attending →
completed, with declined and withdrawn as terminal states. Every
transition writes to an append-only event log with actor and timestamp.

Acceptance: referral link and staff form both create records with correct
source attribution. A referral submitted with a partner_reference_id
carries it through to exportable data; a referral without one works
identically; the field never appears in any member-facing surface — grep
to confirm. Partial intake resumes after a closed tab. Pending applicants
are queryable with intake data via the A2 endpoint. Status transitions
write events. Waitlist groups by relationship and stage. RLS prevents a
partner organization from seeing another's referrals — write the test,
authenticate as real users with their own JWTs, never the service role.

Commit: "feat: referral, intake, status model, and waitlist"
```

## **Stream B — P3: Zoom for Healthcare integration**

```
Read CLAUDE.md before starting.

Video runs on Zoom Workplace for Healthcare with a signed BAA and HIPAA
mode enabled at the account level. Ivan owns that setup; this session is
the integration.

WE DO NOT EMBED VIDEO
No Zoom Video SDK, no Meeting SDK, no WebRTC. We store a join URL and
render a button.

Reasons, so nobody re-litigates this: members already know the Zoom client
and may already have it working. An embedded custom video UI is a new
thing to learn on the night someone needs the group most. Zoom's client
also has its own troubleshooting and support paths, which we do not want
to own for a 78-year-old whose camera stopped working. And Zoom gives us
phone dial-in free, which is a hard accessibility requirement.

SCHEMA
On sessions: video_join_url, video_meeting_id, video_passcode,
video_dial_in_number, video_dial_in_pin, video_provider.

video_provider exists because some partners will require we run on THEIR
Zoom instance. Design for that from the start — a cohort may carry its own
Zoom credentials.

SERVER-TO-SERVER OAUTH
Create meetings via a Zoom Server-to-Server OAuth app. Credentials in
environment variables, never in the repo.

On cohort creation, create a recurring meeting matching the program's
session count and cadence. Store the join URL and dial-in details on each
session row.

ENFORCE SETTINGS AT CREATION — this is the important part
Set these via API so a facilitator cannot create a non-compliant meeting:
  auto_recording: "none"
  waiting_room: true
  password required
  join_before_host: false
  screen share: host only

Recording must be OFF at the account level too, but enforce it here as
well. A dementia support group cannot be recorded under any circumstances,
and if a facilitator can toggle it, eventually one will.

ATTENDANCE PRE-FILL
After a session ends, pull the Zoom participant report and pre-fill the
facilitator's attendance list.

PRE-FILL ONLY. Never auto-commit attendance. The facilitator confirms.
Zoom's report tells us who connected, not who participated — someone who
joined and immediately lost connection is not "present," and only the
facilitator knows that. Attendance feeds facilitator payouts and delivery
evidence, so it needs a human confirming it.

Store the raw Zoom report alongside the confirmed attendance. When the two
disagree, we want to know.

Acceptance: cohort creation produces a recurring meeting with all five
enforced settings verified via the Zoom API. Join URL and dial-in stored
per session. Participant report pulls and pre-fills. Attendance cannot be
committed without a facilitator action. A cohort with its own Zoom
credentials uses them.

Commit: "feat: zoom for healthcare integration"
```

---

# **WAVE 2**

## **Stream A — A1: Admin shell, roles, and partner organizations**

```
Read CLAUDE.md, kinkeepers-frontend-build.md Part 2, and the three-persona
table below before starting.

THREE PERSONAS — the organizing principle
- Internal admin (Ivan, ops): sees everything, can do everything.
- Facilitator: their own cohorts only. Log sessions, mark attendance,
  view their roster.
- Partner staff (health system navigator): only cohorts containing
  caregivers they referred. Read attendance and delivery. Export.
  Nothing else.

Partner staff never see discussion content. Not filtered, not summarized,
not sentiment-scored. This is a hard product boundary — caregivers write
candidly because the room is closed, and that candor is the product. It's
also the strongest thing you can say in a privacy review, so say it out
loud in the UI.

Build the admin shell and the partner organization model.

SHELL
Routes under /admin. Left nav, content area, density appropriate for a
desk user on a laptop. Reuse the design tokens — fonts, colors, focus
rings — from the caregiver app. Do not introduce a second design system.

Nav renders by role. A facilitator sees only "My cohorts." Partner staff
see only "Cohorts" and "Reports." Internal admin sees everything.

Hide by role AND enforce by RLS. A hidden nav item is a courtesy; the
policy is the security. Any route reachable by URL must be refused
server-side for a role that shouldn't have it.

PARTNER ORGANIZATIONS
Table: partner_organizations — name, status, referral_link_slug,
contract_start, contract_end, notes.

Partner staff users belong to exactly one partner organization. Their
access is scoped to cohorts containing at least one caregiver their
organization referred.

That scoping rule is the whole security model for this persona. Write the
RLS policy carefully, and write the test that proves partner A cannot see
partner B's referrals, cohorts, attendance, or exports. Authenticate as
real users with their own JWTs — never the service role key, which
bypasses RLS and makes the test worthless.

Internal admin CRUD for partner organizations. Creating one generates the
referral link slug used in P2.

Acceptance: three test users, one per persona, each seeing only their
permitted nav and data. Partner A blocked from partner B's data at the
policy level, verified by a test that fails if RLS is removed. Direct URL
access to an unpermitted route returns a refusal, not a blank page.

Commit: "feat: admin shell, role-based access, partner organizations"
```

## **Stream B — L1: Sign-in**

```
Read CLAUDE.md, Part 1.2 of kinkeepers-frontend-build.md, and the P1 code
before starting.

Build the sign-in flow. This is the first screen a 74-year-old sees, and
it is where we lose people if we get it wrong.

FLOW
One screen. Email or phone input, one primary action.

Then: "We sent a link to [email]. Open it on this device if you can."
With a resend option that becomes available after 60 seconds, not
immediately — immediate resend invites double-sending and confusion.

For SMS: a six-digit code input. Large, well-spaced digits, numeric
keyboard on mobile, autofill from SMS where the platform supports it.

NO PASSWORDS. No password field, no "create account" form, no "sign up"
versus "sign in" distinction. The same input handles both — if we know the
address, we sign them in; if we don't, intake begins.

That last point matters: a caregiver does not know or care whether she
"has an account." She knows her email address.

ERRORS AND EDGES
- Expired link: explain plainly and offer to send another, on the same
  screen. Never a dead end.
- Wrong code: say so, let them retype without clearing the field.
- Rate limited: "Too many tries. Wait a few minutes, or call us at
  1-800-XXX-XXXX." Always surface the human path.
- Unrecognized address: route to intake, don't reject.

The phone number is visible on the sign-in screen, always. Someone locked
out at 11pm needs a person, not a help article.

Acceptance: both methods work end to end against real Supabase Auth.
Expired link and wrong code both recover without leaving the screen. Rate
limit message shows the phone number. Grep confirms no password field
exists. Keyboard operable. AAA contrast. 56px primary action.

Commit: "feat: passwordless sign-in"
```

## **Stream B (second session) — X5a: RLS test suite, existing boundaries**

```
Read CLAUDE.md before starting.

AMENDMENT: this is the first half of the original X5, covering boundaries
that exist as of Wave 2. Partner scoping, facilitator scoping, and
post-content isolation are X5b in Wave 8, after A1/A5 land.

RLS is the security model for this product. Nothing currently tests it
continuously.

BUILD A SUITE, NOT A TEST
Every isolation boundary gets a test that authenticates as a real user
with their own JWT. Never the service role key — it bypasses RLS and
makes the test worthless while appearing to pass.

Boundaries to cover in this half:
- Organization isolation
- Cohort isolation — a member of cohort A cannot read cohort B's posts
- Role escalation — a member cannot read or write admin tables

NEGATIVE TESTS ARE THE POINT
Each test must fail if the policy is removed. Write the test, delete the
policy, watch it fail, restore the policy. A test that passes with the
policy gone is testing nothing, and this is the most common way RLS test
suites are quietly useless.

CI
Run on every PR. A failing isolation test blocks merge, no override.

Acceptance: all three boundary categories covered. Each test demonstrably
fails with its policy removed — document that you verified this per test.
Suite runs in CI and blocks merge on failure.

Commit: "test: RLS isolation suite (org, cohort, role)"
```

---

# **WAVE 3**

## **Stream A — A2: Intake review and cohort assignment**

```
Read CLAUDE.md and the P2 code before starting.

This is where the product's differentiator actually happens. Build it
well.

REVIEW QUEUE
Internal admin only. List of applicants in pending_review with their
intake data: first name, relationship, care recipient stage, time zone,
availability, referral source, days waiting.

Sort by days waiting — oldest first. Someone who applied twelve days ago
and heard nothing is a person we are failing.

ASSIGNMENT
For each applicant, show every open cohort with:
- its grouping (e.g. "Spouses, early stage")
- current composition broken out by relationship and stage
- remaining capacity
- cadence and meeting time in the APPLICANT's time zone

That last one matters. A great cohort match at 6:30 PM Eastern is useless
to someone in Honolulu, and making the reviewer do time zone math in their
head is how mismatches happen.

Three actions per applicant: assign to cohort, add to waitlist, or decline
with a reason code.

DO NOT BUILD AN AUTO-MATCHER. Not a suggestion engine, not a score, not a
"recommended cohort" badge. Relationship-and-stage matching is human
judgment and it is our differentiator. Surface the signal, let the human
decide.

WAITLIST
Grouped by relationship and stage. For each group show the count and the
oldest wait.

Build one view that answers "which groupings have enough people waiting to
open a new cohort." That's the trigger to open cohort three, and it should
be obvious at a glance rather than requiring a query.

Assignment and decline both write status events and audit rows. A declined
applicant should be re-openable — decisions get revisited.

Acceptance: queue ordered oldest first. Cohort meeting times display in
the applicant's zone. Assignment moves status, writes an event, writes an
audit row, and removes the applicant from the queue. Waitlist groups
correctly and the "ready to open" view returns accurate counts against
seed data. Grep confirms no matching algorithm exists.

Commit: "feat: intake review, assignment, and waitlist"
```

## **Stream B — X2: Program data seeding**

```
Read CLAUDE.md and Part 6 of kinkeepers-frontend-build.md before starting.

A3 lets an admin select a program. No programs exist as data yet — this
session must merge before A3 starts.

SCHEMA
programs — id, name, developer, session_count, session_duration_minutes,
delivery_formats, languages, facilitator_qualification, license_status,
notes
program_sessions — program_id, session_number, title (nullable),
description (nullable)

Titles and descriptions are NULLABLE and stay null until Ivan confirms the
license permits displaying them. Licensed curriculum content may be
protected. Do not populate them from any source, do not infer them, and do
not write placeholder titles that could be mistaken for real ones.

SEED
Seed the programs we may run, from the BPC database facts only — name,
developer, session count, duration, formats, languages, delivery person
type. No curriculum content.

  Savvy Caregiver — 6 sessions, 90-120 min, in person or Zoom, lay leader
  Tele-Savvy — 6 sessions, 90-120 min, Zoom, lay leader
  Powerful Tools for Caregivers — 6 sessions, 90-150 min, in person or
  online, lay leader
  Stress-Busting Program — 9 sessions, 90 min, in person or online, lay
  leader only

license_status is an enum: not_licensed, in_negotiation, licensed. Only
`licensed` programs are selectable when creating a cohort. Enforce it.

That enforcement is the point of this session. It makes it structurally
impossible to run a cohort on a program we haven't licensed, which is a
mistake that would be very expensive and very embarrassing.

Acceptance: A3's program selector (when built) can show only licensed
programs. Session count comes from the program row with no hardcoded
numbers anywhere. Seeded programs carry no curriculum content — verified
by inspecting program_sessions for null titles.

Commit: "feat: program catalog and license gating"
```

## **Stream B (second session) — L2: Referral landing and intake**

```
Read CLAUDE.md, Part 1.2, and the P2 code before starting.

The top of the funnel. Currently there is no way in.

REFERRAL LANDING PAGE
Reached via a partner-scoped link, often from a care navigator's email or
a printed card handed over in a clinic.

Content: what KinKeepers is, in four sentences. Who it's for. What happens
next. One primary action: "Start."

Do not build a marketing page. This person was referred by someone they
trust and is probably exhausted. They need confirmation they're in the
right place and a way forward, not persuasion.

If the partner organization has a name on file, show "Referred by [name]".
Trust transfers.

INTAKE FORM
Ten fields max, per P2. Split across three short steps rather than one
long form — a single page of ten fields reads as a wall.

  Step 1: name, email, phone
  Step 2: relationship, care recipient's stage, time zone
  Step 3: availability windows, contact preference

- Progress indicator: "Step 2 of 3", plain text, no bar
- Save on every field blur. Returning resumes where they left off, and
  say so: "We saved your answers."
- Back always works and never loses data
- Stage question offers "I'm not sure" as an equal option, not an
  afterthought. Many caregivers genuinely don't know, and forcing a guess
  produces bad matching data.

DO NOT COLLECT diagnosis details, medications, the care recipient's name,
or any date of birth. Per P2 — we don't need them and holding them changes
our compliance posture.

CONFIRMATION
"We have your information. Someone will reach out within three business
days." Name the number and hold it. Then the phone number, in case they
need someone sooner.

Acceptance: partner-scoped link attributes referral source correctly.
Partial intake resumes after a closed tab and after a device change on the
same email. Back navigation preserves everything. "I'm not sure" is
selectable for stage. Three steps, ten fields, no prohibited fields
collected. AAA contrast, 48px targets, keyboard operable.

Commit: "feat: referral landing and intake"
```

---

# **WAVE 4**

## **Stream A — A3: Cohort creation and session scheduling**

```
Read CLAUDE.md, the P3 code, the X2 schema, and the program data model
notes in f4milia-master-sequence.md before starting.

Nobody can currently create a cohort. Fix that.

CREATE COHORT
Fields: name, grouping description, program, facilitator, cadence, first
session date and time, time zone, capacity, delivery format, partner
organization (optional).

Program is a selection, never free text. We will run more than one —
Savvy Caregiver is 6 sessions, Stress-Busting is 9, Powerful Tools is 6 —
and session count comes from the selected program, not from a hardcoded
number anywhere.

On creation:
1. Generate the session schedule from program session count and cadence
2. Create the Zoom recurring meeting via P3's integration, with all five
   enforced settings
3. Store join URL and dial-in details per session
4. Write audit rows

If Zoom creation fails, the cohort is created in `draft` and surfaces the
error. Do not create a cohort with silently missing join links — a
facilitator discovering that five minutes before session one is a real
failure.

MANAGE SESSIONS
Reschedule a single session: new date and time, updates the Zoom meeting,
notifies enrolled members through P4 (queue the notification if P4 hasn't
merged yet), writes audit rows.

Cancel a session: requires a reason, notifies members, and does NOT count
against program completion. A cancelled session is our failure, not the
member's absence.

Facilitator substitution per session — the original facilitator stays on
the cohort, the substitute is recorded on that session. This matters for
payouts: base is earned per session delivered, by whoever delivered it.

COHORT LIFECYCLE
draft → active → completed, with cancelled as terminal. Completion fires
the cohort_completed event (P5 instruments it).

Acceptance: creating a cohort produces the correct number of sessions for
the selected program, with Zoom meetings carrying all enforced settings.
Failed Zoom creation leaves the cohort in draft with a visible error.
Rescheduling updates Zoom. A substituted session records the substitute.
Changing programs changes session count with no hardcoded values anywhere
— grep to confirm.

Commit: "feat: cohort creation, scheduling, and lifecycle"
```

## **Stream B — P6: Consent and legal surfaces**

```
Read CLAUDE.md before starting.

These must exist before a real person enrolls. Ivan supplies final
attorney-reviewed text; build against clearly-marked placeholder documents
until then.

DOCUMENTS
- Terms of service
- Privacy policy
- Participant agreement
- Group confidentiality agreement
- Data deletion and export request path

VERSIONING — the part that matters
Every document is versioned. Every consent records which version the
member agreed to, when, and from what IP hash.

Table: member_consents — member_id, document_type, document_version,
agreed_at, ip_hash.

When a document changes, existing members are not silently re-consented.
They see the change and agree again, and we retain both records. "Which
version did this person agree to" must be answerable for any member at any
past date.

GROUP CONFIDENTIALITY
This one is substantive, not boilerplate. Members agree not to share what
others say outside the group. Capture it separately from terms of service,
and surface it in the cohort UI — not just at signup. A support group
where someone's disclosure leaks does real harm, and the agreement should
be visible enough that people remember making it.

DELETION AND EXPORT
A member can request deletion or export. Build the request path and an
admin queue; the fulfillment can be manual for now, but the request must
be recorded with a timestamp and the response logged.

Note in code comments what deletion means for events: aggregate retention
data survives, identifiable records do not.

Acceptance: consent captured at enrollment with correct version. A
document version bump prompts re-consent without erasing the prior record.
Consent history retrievable per member. Deletion request creates an admin
queue item.

Commit: "feat: versioned consent and legal surfaces"
```

---

# **WAVE 5**

## **Stream A — P4-pre: Notification preference migration (standalone PR, under 50 lines)**

```
Read CLAUDE.md before starting.

Single migration, nothing else: the notification-preference column/table
that L3 writes and P4 reads. Channel: email, SMS, or both. Default both.

Open the PR immediately. This merges same-day and Stream B rebases before
its next push — L3 runs concurrently against this same column.

Commit: "feat: notification preference schema"
```

## **Stream A — P4: Reminders**

```
Read CLAUDE.md before starting. The preference schema from P4-pre is
merged; read it.

Probably the highest-ROI feature in this list. For an exhausted caregiver,
"forgot" is a more common reason for missing session four than "didn't
want to go."

SCHEDULE
- 24 hours before session
- 1 hour before session
- One missed-session follow-up, sent the next morning

That's three messages per session maximum. Do not build a sequence, a
nurture flow, or a re-engagement campaign. These are people in crisis, not
leads.

CHANNEL
Member's stored preference: email via Resend, SMS via Twilio, or both.
Default to both for the first cohort — we will learn what works.

TIME ZONE
Render every time in the member's local zone with the zone named. Cohorts
span four zones. "Your session starts at 6:30 PM Eastern, which is 3:30 PM
your time" — say both.

CONTENT — no health information
"Your KinKeepers session starts in 1 hour. Join: [link]. Or call
1-800-XXX-XXXX."

Nothing about dementia, caregiving, the group's composition, or the
program. Assume the message may be read by someone other than the
recipient — a visiting relative, a home health aide, the person being
cared for.

THE MISSED-SESSION MESSAGE
One message. Warm, brief, no guilt, no urgency. "We missed you Tuesday.
The group meets again next week at the same time." That is the whole
message. No "we noticed you haven't been engaging," no streak language, no
question that demands a reply.

MECHANICS
Inngest for scheduling (already in the stack). Idempotent on
(member_id, session_id, reminder_type) — a duplicate send to this
population erodes trust fast.

Log every send: member, session, type, channel, provider message id,
delivered or failed. Failed sends need to be visible; a member who never
receives reminders will silently drop out and we will not know why.

Honor unsubscribe on both channels. An unsubscribed member still appears
in the cohort — they just stop getting messages.

Acceptance: reminders fire at the right local times for members in
different zones. Duplicate job runs send once. Missed-session message
fires only on a confirmed absence, not an unmarked one. Failed sends
surface in an admin view (A5 renders the queue). Unsubscribe stops
delivery without removing enrollment.

Commit: "feat: session reminders"
```

## **Stream B — L3: Consent, preferences, and account**

```
Read CLAUDE.md and the P6 code before starting. Rebase onto P4-pre before
your first push.

CONSENT
Presented at enrollment, after cohort assignment, before the first
session. Four documents: terms, privacy policy, participant agreement,
group confidentiality agreement.

- Each is readable in full on the screen. No "I agree to the terms" over
  a link nobody opens.
- Separate checkbox per document. Not one checkbox for all four.
- Group confidentiality gets its own screen and its own moment. It is the
  substantive one — members agree not to share what others say outside
  the room. Present it as a commitment to the group, not a legal
  formality, because a support group where a disclosure leaks does real
  harm.
- Capture document version per P6.

Re-consent on version change: show what changed, in plain language, at
the top. Never a silent re-agreement.

NOTIFICATION PREFERENCES
P4 reads a preference this screen sets.
Channel: email, SMS, or both. Default both, changeable any time. Explain
plainly what each is used for — session reminders and program updates,
nothing else. No marketing, and say so.

ACCOUNT
Small screen: name, email, phone, time zone, notification preferences,
sign out.

Plus: "Request a copy of my information" and "Delete my account." Both
create P6 queue items and confirm on screen: "We received your request
and will respond within X days." Do not hide these behind a settings
submenu.

GROUP CONFIDENTIALITY, RESURFACED
Show it in the cohort UI, not only at signup. A quiet line on the
discussion screen — "What's shared here stays here" — that links to the
full agreement. People should remember making the commitment.

Acceptance: four separate consents captured with versions. A version bump
prompts re-consent showing what changed, preserving the prior record.
Preference changes take effect on the next reminder. Deletion and export
requests create queue items with on-screen confirmation. Confidentiality
line visible on the discussion screen.

Commit: "feat: consent, preferences, account"
```

---

# **WAVE 6**

## **Stream A — P5: Instrumentation**

```
Read CLAUDE.md before starting.

NOTE: this session edits trigger points inside code owned by P2, P3, A2,
and A3. Stream B is restricted to pure-UI sessions this wave by design.

The M4 gate reads "retention measured at session six." Nothing currently
measures anything. This session makes that gate evaluable.

Run this BEFORE the first real cohort. Retroactive retention analysis on
events that were never recorded is impossible.

EVENTS — append-only, in our own Postgres
  member_enrolled (member, cohort, referral_source)
  session_attended (member, session, cohort, confirmed_by)
  session_missed (member, session, cohort, excused boolean)
  post_created (member, cohort)
  member_dropped (member, cohort, reason_code nullable)
  cohort_completed (cohort, completion_rate)

Table: id, event_type, occurred_at, actor_id, subject_id, cohort_id,
payload jsonb.

NO THIRD-PARTY ANALYTICS
Do not send these to Mixpanel, Amplitude, PostHog, Segment, or Google
Analytics. Participation in a dementia caregiver program is health
information about identifiable people. Events stay in our database and we
query them with SQL.

DERIVED VIEWS
- attendance_rate_by_session_number — where in the program people drop
- retention_at_session_3 and retention_at_session_6
- engagement_rate — members posting between sessions
- referral_conversion — by partner organization
- cohort_fill_time — referral to enrolled

Build these as views or functions, not a dashboard. Ivan reads them with
a query for now.

Acceptance: every event fires from its real trigger, verified by walking
a seeded cohort through six sessions. retention_at_session_6 returns a
correct number against known seed data. Grep confirms no analytics SDK
exists in the codebase.

Commit: "feat: event instrumentation and retention views"
```

## **Stream B — L4: Waitlist and program states**

```
Read CLAUDE.md and the P2 code before starting.

The states between "applied" and "attending." Currently invisible to the
member, which means people wait in silence.

WAITING FOR REVIEW
"We have your information and we're finding the right group for you."
Show when they applied. No fake progress, no estimated time we can't
honor.

WAITLISTED
Honest and specific: "We don't have a group that fits you yet. We're
looking for spouses caring for a partner in early-stage dementia, meeting
evenings Eastern."

Naming the specific grouping does two things — it shows we're matching
deliberately rather than warehousing them, and it explains the wait
without apologizing for it.

Offer the 800 number. Someone waiting three weeks may need to talk to a
person now.

ASSIGNED, BEFORE SESSION ONE
First session date and time in their zone, join link, dial-in,
facilitator first name, what to expect at a first session. Enough that a
nervous person can picture it.

PROGRAM COMPLETE
After the final session: what they completed, and what's next if anything
is. If there's a next program, offer it. If there isn't, say so honestly
and leave the door open.

Do not build a certificate, a badge, or a celebration screen. Finishing a
dementia caregiving program is not an achievement to congratulate someone
for — the situation that brought them there hasn't improved.

Acceptance: each state renders correctly and transitions on real status
change. Waitlist names the specific grouping sought. Phone number visible
in waiting and waitlisted states. No gamified completion.

Commit: "feat: waitlist and program state screens"
```

## **Stream B (second session) — F1: Facilitator home and schedule**

```
Read CLAUDE.md and Part 1.2 before starting.

Frontend session 4 built the session log. Denise has no schedule, no
roster access, and no way to see what's next.

Facilitators are lay leaders — not clinicians, not necessarily technical,
possibly running four cohorts at once. Same design constraints as the
member app: they're often doing this in the evening after other work.

HOME
- Next session: cohort, date, time in their zone, join link, one primary
  action
- Sessions needing a log — this is the nudge that keeps delivery evidence
  complete, and it should be the second thing they see
- Their cohorts, with session position ("4 of 6") each

SCHEDULE
Upcoming sessions across all their cohorts, chronological. Past sessions
with log status: logged, or not logged and how many days overdue.

A facilitator running four cohorts needs to see collisions. If two
sessions overlap, say so plainly.

Acceptance: home shows next session and outstanding logs. Schedule spans
all cohorts chronologically. Overlaps flagged. Times in the facilitator's
zone. 48px targets, AAA contrast, keyboard operable.

Commit: "feat: facilitator home and schedule"
```

---

# **WAVE 7**

## **Stream A — A5: Oversight and queues**

```
Read CLAUDE.md and the P4, P6, and P7a code before starting.

The screens that catch things going wrong. Unglamorous and load-bearing.

ATTENDANCE OVERSIGHT
Internal admin view across all cohorts: the attendance matrix from
frontend session 5, but live and multi-cohort.

Flag two things:
- Sessions past their date with no facilitator log submitted
- Members with two or more consecutive absences

The second is a retention intervention trigger, not a compliance flag. It
routes to a human who calls them. Do not name it a risk score, do not
compute a severity, and do not analyze post content to produce it —
absence count only. We are peer support, not clinical monitoring.

Admin can correct an attendance record. Corrections are visibly
corrections, preserve the prior value, and write audit rows. Attendance
feeds payouts, so an unexplained edit is a dispute waiting to happen.

REMINDER FAILURES
Failed sends from P4: member, session, channel, error. A member silently
not receiving reminders will drop out and we will never know why, so this
needs to be a screen someone checks, not a log someone greps.

CONSENT AND DELETION QUEUE
Members with missing or outdated consents from P6. Deletion and export
requests with request date, status, and fulfillment record.

Deletion fulfillment can be manual, but the queue and the timestamps
cannot. "How fast do you honor deletion requests" is a standard
procurement question with no acceptable improvised answer.

AUDIT LOG
The P7a log, readable and filterable by actor, action type, subject, and
date. Build this so an outside reviewer could use it without a
walkthrough. A health system security review will ask for exactly this
screen, and the version that requires explanation is the version that
fails.

PARTNER REPORTS
Scope frontend session 5's read-only cohort list, attendance matrix, and
CSV export to the partner staff persona, wired to real data.

AMENDMENT: the partner CSV export includes the partner_reference_id
column from P2, scoped identically to the rest of the export.

Export stays labeled "Export attendance and delivery (CSV)". No CMS-named
reports, no acronyms, no UI text claiming this satisfies a regulatory
requirement.

Verify by grep that no partner-scoped route or component can reach post
content. The admin view must be structurally incapable of reading
discussion, not merely lacking a link to it.

Acceptance: unlogged past sessions surface. Two-consecutive-absence flag
accurate. Attendance corrections preserve prior values and write audit
rows. Reminder failures visible. Consent gaps and deletion requests
queued with timestamps. Audit log filterable and legible to an outsider.
Partner export scoped correctly and carrying partner_reference_id, and
grep confirms no path from partner routes to post content.

Commit: "feat: admin oversight, queues, and partner reports"
```

## **Stream B — X3: Transactional messages**

```
Read CLAUDE.md and the P4 code before starting. This reuses P4's Inngest
pipeline — P4 must be merged.

P4 built session reminders. These are the event-driven messages, and
their absence means someone can be assigned to a cohort and never told.

MESSAGES
1. Application received — sent on intake completion. Sets expectation:
   "We'll be in touch within three business days." Say a number and hold
   it.
2. Cohort assigned — the welcome. First session date, time in their
   local zone, join link, dial-in number, facilitator first name, what
   to expect.
3. Waitlisted — honest, not apologetic. "We don't have a group that fits
   you yet. We'll reach out as soon as we do." No fake timeline.
4. Session rescheduled — new time, both zones, updated link.
5. Session cancelled — reason, next session date.
6. Program complete — after the final session. Warm, brief, and it names
   what comes next if anything does.
7. Sign-in link and code — from P1, same delivery pipeline.

CONTENT RULES
No health information. No program description. Assume the message may be
read by someone other than the recipient — a visiting relative, a home
health aide, the person being cared for.

Voice matches the app: plain, warm, never cheerful about the situation,
no emoji, no exclamation points. Every string goes in the copy deck.

MECHANICS
Inngest, idempotent on (member_id, message_type, subject_id). Log every
send with provider message id and delivery outcome. Failed sends surface
in A5.

Both channels per the member's preference. Sign-in messages always go to
the channel the person requested them on.

Acceptance: each of the seven fires from its real trigger. Times render
in the recipient's zone. Duplicate job runs send once. No health
information in any template — read all seven aloud and check. Failures
surface in the A5 view.

Commit: "feat: transactional messages"
```

---

# **WAVE 8**

## **Stream A — L5: API integration**

```
Read CLAUDE.md and Part 1.2 before starting.

NOTE: this session owns the member data layer this wave. Stream B touches
only test files and new cert tables/screens.

Every screen built in frontend sessions 0-6 reads from /lib/fixtures.
Swap the data layer for real endpoints.

MECHANICS
Session 0 exposed data access as functions — getCohort, getSessions, and
so on. Change those implementations. Components should not need edits; if
a component needs editing, the original abstraction leaked and fixing
that is part of this session.

LOADING STATES
Plain text "Loading…" per the design system. No skeleton shimmer — it
reads as instability, and this audience is already uncertain whether
they're doing it right.

ERROR STATES — this is the real work
Every failure needs a state a tired 74-year-old can act on:
- Network failure: "We couldn't load this. Check your connection and try
  again." Plus a retry button and the phone number.
- Auth expiry: route to sign-in with a plain explanation, never a blank
  screen or a raw 401.
- Not found: explain what happened, offer a way back.
- Server error: apologize once, plainly, give the phone number.

Never show an error code, a stack trace, or the word "error" alone. Never
a dead end without a path forward. The phone number appears in every
failure state — this population's fallback is a person, not a refresh.

OFFLINE AND SLOW
Assume rural broadband and old devices. Test on throttled 3G. Cache the
next session details so a member with a flaky connection can still see
when and where to join.

Acceptance: every screen renders from real endpoints with fixtures fully
removed — grep confirms no imports from /lib/fixtures outside tests. All
four error states reachable and recoverable. Phone number present in
every error state. Usable on throttled 3G. Auth expiry mid-session
recovers cleanly.

Commit: "feat: api integration and error states"
```

## **Stream B — X5b: RLS suite completion**

```
Read CLAUDE.md before starting.

AMENDMENT: second half of the original X5 — the boundaries that needed
A1/A5 to exist. Same methodology as X5a: real JWTs, never service role;
write test → delete policy → watch fail → restore; CI blocks merge.

Boundaries to cover:
- Partner scoping — partner A cannot see partner B's referrals, cohorts,
  attendance, or exports
- Facilitator scoping — a facilitator cannot read a cohort they don't run
- Post content — no partner-scoped or admin-scoped path reaches
  discussion content

Add a README section explaining how to add a boundary test when a new
table lands, so this doesn't decay.

Acceptance: all three boundary categories covered. Each test demonstrably
fails with its policy removed — document that you verified this per test.
README section present.

Commit: "test: RLS isolation suite complete"
```

## **Stream B (second session) — A4-cert: Facilitator management, certification half**

```
Read CLAUDE.md before starting.

AMENDMENT: this is A4 minus the payouts view, which is parked on B1/B3.
Do not build or stub any payout screen — a payout screen showing
placeholder numbers is worse than no screen.

Survivable as a spreadsheet at one cohort. Fatal at ten.

FACILITATOR RECORDS
Profile, contact, status, time zone, and the cohorts they run.

CERTIFICATION TRACKING — the part that actually matters
Table: facilitator_certifications — facilitator, program, certified_on,
expires_on, certifying_body, evidence_note.

A facilitator may only be assigned to a cohort for a program they are
currently certified in. Enforce this at assignment: block it, and say
why.

Surface expiring certifications 60 days out. Delivering a licensed
evidence-based program with a lapsed certification breaks fidelity and
breaches the license — and it means claiming evidence we no longer have
the right to claim. That is the worst available exposure in a healthcare
sale, so make the warning loud.

CAPACITY
Show each facilitator's active cohort count and weekly session load. One
facilitator running four cohorts is our intended model; one running nine
is a quality problem before it's a scheduling problem.

Acceptance: assignment to an uncertified program is blocked with a clear
reason. Expiring certifications surface at 60 days. Capacity view
accurate against seed data.

Commit: "feat: facilitator management and certification tracking"
```

---

# **WAVE 9**

## **Stream A — X4: Dial-in identity**

```
Read CLAUDE.md and the P3 code before starting.

Small feature, outsized meaning.

THE PROBLEM
Zoom's participant report identifies phone joiners by phone number, not
name. So P3's attendance pre-fill silently fails for exactly the members
who join by phone — the ones with no broadband, or who can't manage
video, or whose hands shake.

Those are the people this program exists for most. Right now they are
invisible to the attendance record, which means invisible to retention
data and to the facilitator's payout calculation.

BUILD
- Store each member's phone number in E.164 on their profile
- Match Zoom participant report phone entries against member phone
  numbers
- Normalize before matching: strip formatting, handle country code
  present or absent, handle the leading 1 on US numbers
- Matched entries pre-fill exactly like video joiners
- Unmatched phone entries surface to the facilitator as "Unidentified
  caller — (last 4 digits)" so they can attribute it manually

Do not guess at partial matches. An unmatched caller is shown as
unmatched; the facilitator resolves it. Wrong attribution on an
attendance record that feeds a payout is worse than no attribution.

ALSO
Surface the dial-in number and PIN in the member UI everywhere the video
join link appears, not buried behind a disclosure. A member who can't get
video working needs the phone option visible in that moment, not one tap
away.

Acceptance: a phone joiner whose number matches a member pre-fills
correctly. Numbers with and without country code both match. An unknown
caller surfaces as unidentified with last four digits and can be manually
attributed. Dial-in details appear alongside every join link in the
member UI.

Commit: "feat: dial-in participant identification"
```

## **Stream B — F2: Session prep and roster**

```
Read CLAUDE.md before starting. A4-cert must be merged — materials gating
depends on the certifications table.

PREP VIEW
Before a session: which session number, the roster, who's marked as not
attending, and any materials.

Roster shows first name, relationship, and how many sessions they've
attended. Nothing else — no notes about members, no history of what
they've said, no flags.

That constraint is deliberate. A facilitator running a peer support group
should meet people as they are that evening. Accumulated notes create a
file on a person, and members would speak differently knowing one exists.

Show consecutive absences as a plain count — "attended 2 of 4" — so a
facilitator can reach out. No flag, no color, no severity.

MATERIALS
Licensed curriculum materials, access-controlled, visible only to
facilitators certified in that program. Download only, no public URLs, no
sharing links. The license depends on this.

If materials aren't loaded yet, show an honest empty state rather than
hiding the section.

Acceptance: prep view shows roster with attendance counts and no member
notes. Materials restricted to certified facilitators — verified with a
test user lacking certification. No public material URLs. Grep confirms
no per-member notes field exists.

Commit: "feat: session prep and roster"
```

## **Stream B (second session) — P7b: Observability completion**

```
Read CLAUDE.md before starting.

AMENDMENT: second half of the original P7. The audit log, structured
logs, and health check landed in P7a.

ERROR TRACKING
Sentry, with PII scrubbing configured BEFORE the first event is sent.

Default Sentry configuration will capture request bodies, headers, and
user context — which for us means names, emails, phone numbers, and
intake data in a third-party system with no BAA. Configure the scrubber
first, verify it with a deliberate test error containing fake PII, and
confirm nothing identifiable arrives.

If PII scrubbing cannot be verified, do not enable Sentry. Log to our own
database instead.

UPTIME
External uptime monitoring on the app, the auth flow, and the Zoom
integration, hitting the P7a health check. Alert to a channel Ivan
actually reads.

Acceptance: a deliberate error reaches Sentry with zero PII — verified,
not assumed. Uptime alerts fire on a simulated outage.

Commit: "feat: error tracking and uptime monitoring"
```

---

# **WAVE 10**

## **Stream A — R1: Deploy pipeline and rollback runbook**

```
Read CLAUDE.md before starting. Completes before cohort one's first
live session — a rollback discovered to be impossible during a live
caregiver cohort is not a recoverable situation.

DEPLOY
One-command deploy from main, gated on green CI including the full
pgTAP suite. Environment variables documented; staging and
production differ only where the X1 README already says they do.

MIGRATION ROLLBACK
Every migration in the repo gets a decision, recorded in the
migration file itself: a tested down-path, or a documented
forward-fix with the reason a down-path is unsafe. No migration is
undecided.

ROLLBACK DRILL
In staging, with seeded data: deploy, migrate, roll back, verify
data intact and app healthy. Document the exact steps as executed —
the runbook is the drill's transcript, not a hypothetical.

INCIDENT NOTES
One page: who flips what when a bad merge reaches production, and
how members are told if a session is affected — plain language, the
phone number, no invented reassurances. A health system security
review may ask for this page; write it so it survives that reading.

Acceptance: the staged rollback drill executed and documented.
Deploy from clean main completes in under 10 minutes. The runbook is
followable by someone who didn't write it. Every migration carries
its rollback decision — grep for undecided migrations returns zero.

Commit: "chore: deploy pipeline and rollback runbook"
```

---

# **PARKED (blocked on B1/B3 — confirm status by end of Wave 5)**

## **A4-payouts: Agreements and payouts view**

```
Read CLAUDE.md and section 2 of f4milia-revenue-model.md before starting.
Do not run until B1 and B3 exist.

Read-only view of the mentor_agreements and mentor_payouts records from
B1 and B3: base rate, share rate, effective dates, and payout history
with the stored calculation inputs.

Payout release stays where B3 put it — behind an explicit reviewer
action, never automatic. This screen shows; it does not release.

Acceptance: payout history shows stored calculation inputs, not
recomputed values. No release action exists on this screen.

Commit: "feat: facilitator agreements and payout history (admin)"
```

## **F3: Facilitator account and payouts**

```
Read CLAUDE.md, section 2 of f4milia-revenue-model.md, and B3 before
starting. Do not run until B1 and B3 exist.

ACCOUNT
Profile, contact, time zone, notification preferences, sign out.

CERTIFICATIONS
Which programs they're certified in, when each expires. Expiry warning at
60 days, plainly worded, with who to contact.

PAYOUTS
Read-only. Per period: base earned from verified sessions, share from
retained revenue, adjustments, total, and status.

Show the calculation inputs — session count, the retained revenue figure,
the rate applied. Use the stored values from B3, never recomputed.

A facilitator asking why a payout changed must get an answer from this
screen without contacting anyone. Trust is the whole relationship here,
and an opaque payout is how it breaks.

Explain the model in one plain paragraph on this screen: base per session
delivered, plus a share of revenue from members past 60 days. State that
they don't earn on a member's first month, and why — KinKeepers pays for
acquisition, the facilitator is paid for retention. Better they read it
here than infer it from a number that looks lower than expected.

Acceptance: payout history shows stored inputs, not recomputed values.
Certification expiry warns at 60 days. The compensation explanation is
present and accurate. No payout release action exists on this screen —
release stays behind the B3 reviewer gate.

Commit: "feat: facilitator account, certifications, payouts"
```

---

# **PROPOSED — B1 / B3: Facilitator agreements and payouts (added 2026-09-04, not yet approved)**

**Status:** proposal for Ivan's review at 09:30. Not runnable until the four decisions below are recorded here. Written by Stream A after confirming that "B1"/"B3" do not correspond to any session in any F4milia/Trib4l planning document — `trib4l-build-from-zero.md` v2.1 builds org-level Stripe Connect commerce (Sessions 13–16) and platform revenue-ops (Session 19), never individual mentor or facilitator compensation; the F4milia Complete Run Doc states "commerce stays dormant-per-Tower and nothing in this doc touches it"; and `f4milia-revenue-model.md` flags mentor payouts as "new scope beyond what Session 9 or Session 16 currently describe... worth resolving which session owns it," which no later document did. A4-payouts and F3 were parked on work nobody scheduled. These two prompts are that work, scoped to KinKeepers' own schema — KinKeepers runs its own Supabase project, so there is no parent-platform table for its screens to read from regardless of what F4milia builds later.

**Naming.** A4-payouts and F3 say `mentor_agreements` / `mentor_payouts`. KinKeepers has no mentor role (`app_role` is admin / facilitator / partner_staff / member); the tables below are `facilitator_agreements` / `facilitator_payouts`. Read the A4-payouts and F3 prompts with that substitution.

**B2 is deliberately not written.** Moving money through the platform — Stripe Connect, bank details — is out: Stripe is not in the KinKeepers stack, F4milia's own run doc keeps commerce dormant, and `f4milia-revenue-model.md` §3 puts the payment-platform legal items ahead of any of it. B3's "release" is a reviewer gate that records that payment happened out of band. It is not a transfer.

## Decisions Ivan records before B1 launches

| # | Decision | Recommendation | Why it can't be built around |
| ----- | ----- | ----- | ----- |
| 1 | Do KinKeepers facilitators earn a revenue share, or a per-session rate only? | **Per-session only.** `f4milia-revenue-model.md` §2's facilitator row says exactly that: "Runs sessions to our curriculum. Not a draw. Per-session rate only. No share." F3's prompt text ("share of revenue from members past 60 days") is the *mentor* row's model, and "retained member revenue" has no referent in KinKeepers, which is sold to health systems, not to members. | It decides whether B1 has share columns at all, and whether F3's compensation paragraph is true. A column nothing writes is a claim nothing checks. |
| 2 | What does "release" do? | **Status change plus audit row, nothing else.** The reviewer records the out-of-band payment reference (payroll batch, invoice number) in a required release note. | Anything more is B2, and B2 is gated on legal. |
| 3 | Payout period | **Calendar month.** A facilitator runs several cohorts at once; a monthly statement is what a contractor expects and composes cleanly with substitute attribution. Per-cohort statements split one person's month across N screens. | Period is the grain of the payout row. Changing it after real rows exist is a rewrite, not a migration. |
| 4 | One rate per facilitator, or per (facilitator, program)? | **Per facilitator.** Nothing in either companion doc prices Stress-Busting differently from Tele-Savvy. If that's wrong, add a nullable `program_id` to `facilitator_agreements` in B1 — not after B3 has frozen rates onto payout rows. | Same reason as 3. |

Not a decision — a constraint both sessions inherit: **base is earned per session delivered, by whoever delivered it.** That rule is already in the schema (`sessions.substitute_facilitator_id`, A3's `20260829180000_cohort_creation_schema.sql`, whose comment quotes this exact sentence). A substitute is paid for the session they ran; the cohort's facilitator is not.

The rate itself — dollars per session — is data on the agreement row, entered by an admin. No decision blocks the build (CLAUDE.md #10), only the first real row.

**If decision 1 lands as recommended,** F3's PAYOUTS paragraph is amended to: *"Per period: sessions delivered, the rate applied, adjustments, total, and status. Show the inputs — session count and rate — as stored on the payout, never recomputed. Explain the model in one plain sentence: you are paid a fixed amount for each session you deliver, confirmed by your own session log."* The retained-revenue and first-month sentences are removed.

## **Stream A — B1: Facilitator agreements**

```
Read CLAUDE.md, section 2 of f4milia-revenue-model.md (recovered onto
main via PR #126), and the four decisions above before starting. Do
not start until they are recorded here.

Greptile-tier (supabase/migrations/**, app/admin/**). Merges at 09:30
with Ivan present — compensation is the one KinKeepers surface where a
silent error is a wrong payment, the same reasoning that gates
F4milia's A5.

Small session. B3's payout math is only as trustworthy as the
agreement row it reads its rate from, so this session's whole job is
making that row boring: append-only, non-overlapping, audited.

TABLE: facilitator_agreements
  id, facilitator_id → profiles (RESTRICT, not cascade — this is a
  financial record; deletion-request fulfillment anonymizes a profile
  with payment history, it never hard-deletes one, same as audit_log),
  base_rate_cents int > 0, currency char(3) default 'USD',
  effective_from date, effective_to date null (open-ended),
  agreement_reference text (where the signed contract lives — a
  pointer, never the document; no uploads), notes text, created_at.

  No two agreements for one facilitator may overlap in time: an
  EXCLUDE constraint on (facilitator_id, daterange(effective_from,
  effective_to, '[)')) via btree_gist. The database enforces it, not
  the form.

  A rate change is a new row: end the current agreement (set
  effective_to), create the next one. Never UPDATE base_rate_cents.
  Same "history, not a mutable status" shape as
  facilitator_certifications and member_consents — a payout row from
  March must still point at the agreement that was in force in March.

  If decision 1 = base + share: add share_rate numeric(5,4) here AND
  stop. The retained-revenue source table does not exist in
  KinKeepers, so that branch adds a session, not a column. Report it.

FUNCTIONS (security definer, set search_path = '', record_audit_event
in the same transaction, revoke execute from public/anon/authenticated,
grant to service_role — the add_facilitator_certification pattern):
  create_facilitator_agreement(actor_id, target_facilitator_id,
    p_base_rate_cents, p_currency, p_effective_from, p_effective_to,
    p_agreement_reference, p_notes) — refuses a non-facilitator
    profile and an overlap, naming the agreement it overlaps.
  end_facilitator_agreement(actor_id, agreement_id, p_effective_to) —
    only on an open-ended row; effective_to may not precede
    effective_from.
  New audit_action values: facilitator_agreement_created,
  facilitator_agreement_ended. Own migration (enum rule).

RLS: revoke all from anon/authenticated first. A facilitator selects
their own rows (F3 reads this). No policy for partner_staff — that
they have no path to compensation data is proven by the RLS suite,
not assumed. Admin reads and writes through the service-role client
from a Server Action behind requireRole(["admin"]).

ADMIN UI — a new Agreement section on /admin/facilitators/[id]:
current agreement (rate, since when, reference), history below it,
"New agreement" form, "End agreement" with a confirm dialog that
names the end date. Density exemption applies. Copy in lib/copy.ts.

TESTS
pgTAP: overlap refused; adjacent (effective_to = next effective_from)
accepted; a facilitator sees own rows only; a second facilitator sees
none; anon sees none; partner_staff sees none; audit rows via the
baseline-delta pattern, never an absolute count. Negative drill on
each `revoke` line, not the `grant` lines (Learned Constraints,
2026-09-02 L5). vitest on the Server Action: a member and a
facilitator are refused before any write. Every migration adds its
row to docs/migration-rollback-decisions.md in the same PR.

Named edge case for the 09:30 review: create a second agreement
overlapping the current one → refused, naming the overlap. End the
current one first, then create the next → accepted. A session
delivered in a gap between two agreements is B3's to surface, not
this session's to prevent — confirm B3's prompt covers it before
merging.

Acceptance: overlap is impossible at the database level. A rate
change leaves the old row intact and readable. Every write has an
audit row. A facilitator can read their own agreement and nobody
else's. No payout number appears anywhere yet.

PR plan: (1) audit_action values; (2) table + constraint + functions +
pgTAP; (3) Server Actions + admin section + copy + vitest. Each under
200 lines. Migrations merge same-day.

Commit: "feat: facilitator agreements"
```

## **Stream A — B3: Payout computation and reviewer release**

```
Read CLAUDE.md, B1 as merged, and X4's submit_session_log() before
starting. Do not start until B1 has merged and decisions 2 and 3 are
recorded.

Greptile-tier; merges at 09:30 with Ivan present. Highest-stakes
KinKeepers session after P1.

THE BOUNDARY, STATED FIRST
The payout for a session is base_rate_cents on the agreement in force
on the day the session was scheduled — once and only once, for the
person who delivered it. Nothing here estimates, prorates, rounds, or
adjusts on its own. A reviewer releases; the system never does
(invariant #11). Release is a status, not a transfer (decision 2).

WHAT COUNTS AS A DELIVERED SESSION
sessions.status <> 'cancelled' AND session_logs.delivery_confirmed =
true for that session. Nothing else — not scheduled_at having passed,
not attendance rows existing, not a Zoom report. The facilitator's own
confirmed log is the evidence (invariant #7); X4 already made it the
source of truth for attendance, and it is the source of truth here for
the same reason.

WHO DELIVERED IT
coalesce(sessions.substitute_facilitator_id, cohorts.facilitator_id).
Already the schema's stated rule. Do not re-decide it.

TABLES
  facilitator_payouts: id, facilitator_id → profiles (RESTRICT),
    agreement_id → facilitator_agreements (RESTRICT), period_start,
    period_end, currency, session_count int, rate_applied_cents int
    (COPIED from the agreement at compute time — the agreement is
    referenced for provenance and never joined for the number),
    base_amount_cents int, adjustment_cents int default 0,
    adjustment_reason text, total_cents int, status payout_status
    (pending_review | released | void), computed_at, computed_by,
    released_at, released_by, release_note text.
    Partial UNIQUE (facilitator_id, period_start) where status =
    'pending_review': one open statement per facilitator per period.
    A session confirmed late, after that period's payout was released,
    goes into a NEW pending row for the same period — it never reopens
    the released one.

  facilitator_payout_items: id, payout_id, session_id → sessions,
    kind (session | reversal), amount_cents, reverses_item_id null.
    Partial UNIQUE index on session_id where kind = 'session': a
    delivered session enters a payout exactly once, ever, and the
    database says so.

FUNCTIONS (same security/audit/grant pattern as B1)
  compute_facilitator_payouts(actor_id, p_period_start, p_period_end)
    For every delivered session scheduled in the period with no
    'session' item yet: find the deliverer, find their agreement in
    force on scheduled_at::date, and either (a) add an item to that
    facilitator's pending payout for the period, creating the row if
    needed, or (b) return the session in an `uncovered` set — no
    agreement covers it — for the reviewer, loudly. An uncovered
    session is never paid at any rate and never silently skipped.
    Idempotent: re-running for the same period adds only what the
    unique index permits. One audit row (payout_computed) per payout
    row created or extended, carrying the session ids added.
  release_facilitator_payout(actor_id, payout_id, p_release_note)
    pending_review → released only. Sets released_by/at. Audit row
    (payout_released) carrying total_cents and session_count. The
    release note is required, not optional — it is where the
    out-of-band payment reference goes (decision 2), for the same
    reason issueAdminSignInLink requires a reason.
  void_facilitator_payout(actor_id, payout_id, p_reason)
    pending_review → void only, and deletes its items so those
    sessions are eligible for the next compute. Nothing was paid, so
    nothing is reversed. A released payout can never be voided.
  A trigger makes released payouts and their items immutable: any
  UPDATE or DELETE raises. The March statement a facilitator saw is
  the March statement forever.

CORRECTIONS AFTER RELEASE
X4's submit_session_log() can correct delivery_confirmed after the
fact. When a session already inside a released payout is corrected to
not-delivered, the next compute surfaces it as a reversal candidate
alongside `uncovered`; the reviewer confirms it, and a 'reversal'
item with a negative amount lands in the current period's pending
payout, pointing at the item it reverses. Never automatic. The
released row is unchanged byte-for-byte. (A session corrected the
other way — newly confirmed — simply becomes eligible; no special
path.)

New audit_action values: payout_computed, payout_released,
payout_voided. New enum payout_status. Own migration.

RLS: revoke all from anon/authenticated. A facilitator selects their
own payouts and items (F3 reads this). partner_staff: no path, proven.
Admin through the service-role client behind requireRole(["admin"]).

NO NEW ANALYTICS EVENT. P5's event list does not include payouts, and
inventing one is inventing. audit_log is the record.

NO BANK DETAILS. Do not add account numbers, routing numbers, or any
payment-rail identifier to any table in this session. That is B2, and
B2 does not exist.

ADMIN UI — /admin/payouts:
  Compute: pick a month, run. The result lists each facilitator's
  pending payout (sessions, rate, total) and, ABOVE them, the
  uncovered sessions and reversal candidates — those render first and
  loudest, because they are the reviewer's actual job.
  Release: per payout, a confirm dialog that says exactly what
  happens: "Mark <name>'s <Month> payout of <amount> as released. This
  records that payment was made outside KinKeepers; it does not move
  money." Release note required.
  History: released payouts by month, read-only, with items.
  Density exemption applies. Copy in lib/copy.ts.

TESTS
pgTAP, all with real fixtures — a cohort, its facilitator, a
substitute, agreements with real dates:
  - a delivered session enters exactly one payout; a second 'session'
    item for it fails on the index, not in application code
  - a session delivered by the substitute pays the substitute at the
    substitute's own rate, and adds nothing to the cohort facilitator
  - delivery_confirmed = false → not paid; status = 'cancelled' → not
    paid; a session with no covering agreement → in `uncovered`, in no
    payout
  - compute twice for one period → identical result, no duplicates
  - rate_applied_cents equals the agreement's rate at compute time and
    does not change when that agreement is later ended and replaced
  - UPDATE on a released payout raises; DELETE on its item raises
  - void deletes items; those sessions reappear on the next compute
  - facilitator A sees A's payouts and none of B's; anon and
    partner_staff see none
  - audit rows via baseline-delta, never an absolute count
  Negative drill on every `revoke` line. vitest on each Server Action:
  role refusals before any write, and the release-note requirement.
  Rollback-decisions rows for every migration.

Named edge case for the 09:30 review: release a payout, then correct
one of its sessions to not-delivered through the real facilitator
session-log screen. The released row is unchanged (select it before
and after; the diff is empty). The next compute lists that session as
a reversal candidate; confirming it puts a negative item in the
current month's pending payout. Nothing moved without the reviewer.

Acceptance: a delivered session can never be paid twice — proven by a
failing insert, not by application logic. The person paid is the
person who delivered. A session no agreement covers is surfaced, not
skipped or guessed. Released payouts are immutable. Every state change
has an audit row. Release moves no money and says so on screen. A
facilitator can read only their own payouts.

PR plan: (1) payout_status enum + audit_action values; (2) tables +
indexes + compute function + pgTAP; (3) release/void functions +
immutability trigger + pgTAP; (4) Server Actions + /admin/payouts +
copy + vitest. Each under 200 lines. Migrations merge same-day.

Commit: "feat: facilitator payouts, computed once, released by a reviewer"
```

**After both merge:** A4-payouts and F3 unpark. A4-payouts shrinks — B1 already puts the agreement section on the facilitator's admin page, so what remains is the read-only per-facilitator payout history on that same page, with no release action (release lives on /admin/payouts). F3 is unchanged except its compensation paragraph, per decision 1.
