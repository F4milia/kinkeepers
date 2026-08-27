# KinKeepers — Testing & Review Workflow

### The automated pipeline plus calibrated human review. Aligned with BUILD-FORMAT.md's review tiers.

**Executor:** James Jarin | **Owner:** Ivan Rattliff
**Solo-dev note:** with one developer, this pipeline is load-bearing, not advisory. The human review on high-stakes PRs is shared between James (the full checklist below) and Ivan (present at the 09:30 merge window for Greptile-tier PRs). Nothing high-stakes merges outside that window.

**Population note, and why this doc is stricter than F4milia's:** KinKeepers members are family caregivers, older-skewing and mid-crisis, in a program with health-system partners. A privacy failure here isn't a bug ticket — it's a caregiver's private disclosure reaching someone it was never meant for. The consent, reminder, and partner-boundary paths below get treated with the same weight F4milia gives money.

---

## The pipeline (automated, runs on every PR)

1. Claude Code generates code + tests per the session prompt.
2. PR opens, triggering:
   - **pgTAP suite** — the *stable, protected* isolation tests (a member can't read another cohort's rows, no role self-escalates, a partner organization can never reach individual member content) run unchanged on every PR, plus any new pgTAP tests the PR adds for new tables or RLS policies.
   - **ZeroStep** — E2E user-flow validation, path-filtered to `app/**` and `components/**` so backend-only PRs don't wait on browser tests.
   - **CodeRabbit** — diff scan on every PR. Useful signal, not a verdict: diff-only (can't see cross-file or architectural regressions), roughly 44% catch rate per independent benchmark, low noise.
   - **Greptile** — high-stakes PRs only (trigger globs below). Full-codebase context: indexes the whole repo and catches the cross-file breaks CodeRabbit structurally can't. Higher catch rate (~82% benchmarked), noisier — expect to triage some false positives; that's the trade being paid for on purpose.

## The trigger globs (what makes a PR high-stakes)

```
supabase/migrations/**
lib/auth/**
**/rls*
**/zoom/**
**/reminders/**
**/consent/**
**/audit/**
app/admin/partners/**
```

Plus, always, regardless of path: anything touching facilitator payouts, money, or compensation records; any path where partner-organization users could reach member-level data; any new AI-to-write path if AI features ship here; anything Ivan marks manually in the PR description.

---

## Step 1: Triage

**High-stakes** — any trigger above fires — Greptile runs — the full path in Step 2b, merge only at 09:30 with Ivan present.

**Low-stakes** — everything else (UI components, copy-deck strings, wiring to an already-existing table) — Step 2a, merge any time.

New pgTAP tests written in the same pass as the code they test are *always* high-stakes — a test can be green and still validate the wrong behavior if the same generation wrote both.

---

## Step 2a — Low-stakes path

1. Confirm all automated gates passed.
2. Read the diff for basic sanity — is this actually what the session asked for, and are all strings from the copy deck rather than invented.
3. Merge. Genuinely fast is fine here; this isn't where the risk lives.

---

## Step 2b — High-stakes path: the full Testing/QA + Integration Buffer

**Testing/QA:**

1. Read every line of the diff — understand it, don't skim it. If Claude Code touched a file the session didn't mention, know why before proceeding.
2. Confirm the stable core isolation suite still passes unchanged.
3. Read the *new* tests this PR added — do they test the right thing, not just whether they're green.
4. Triage Greptile's findings — each one is either a real issue (fix-forward now) or a documented false positive (note why, in the PR). Don't dismiss in bulk.
5. Verify the session's **named edge case** by hand — every Greptile-tier session in the run doc names one; that's what gets checked here, not a general vibe pass.
6. For anything touching RLS or partner boundaries: one manual check beyond the automated suite — sign in as a partner-organization user and as a member of a different cohort, try to reach member content directly, watch both fail correctly.
7. For anything touching reminders or Zoom: verify against staging in test mode — no real SMS, no real email, no real meeting invites leave staging, ever. A reminder misfire to a real caregiver's phone is a trust breach, not a test artifact.

**Integration Buffer:**

8. Merge to a real branch and run a full regression pass, not just this PR's own tests.
9. Confirm CLAUDE.md and BUILD-FORMAT.md rules were followed — RLS not bypassed, no invented copy (the copy deck is the only source of member-facing strings), consent recorded before anything consent-gated fires, every mutation in the audit log.
10. Write down anything that surprised you or was ambiguous in the session prompt — that note feeds back into the run doc as an amendment. Don't silently work around it.
11. Budget this as real time. This is the step a "2-minute sanity check" quietly skips, and it exists because even the best automated reviewer here misses roughly one bug in five.

---

## Calibration — a standing practice, not a one-time test

The first time each *new category* of high-stakes work runs (first RLS migration, first Zoom integration path, first consent-gated reminder, first payout record), time it honestly: clock starts before opening Claude Code, stops when it's genuinely mergeable — full checklist done, not first successful run. Report the elapsed time, whether the generated tests were sufficient, and what the prompt failed to anticipate. That third item becomes a run-doc amendment. Real numbers from real sessions are what estimates get corrected against — never the other way around.
