# F4milia — Testing & Review Workflow

### The automated pipeline plus calibrated human review. Aligned with BUILD-FORMAT.md's review tiers.

**Executor:** James Jarin | **Owner:** Ivan Rattliff
**Solo-dev note:** with one developer, this pipeline is load-bearing, not advisory. The human review on high-stakes PRs is shared between James (the full checklist below) and Ivan (present at the 09:30 merge window for Greptile-tier PRs). Nothing high-stakes merges outside that window.

This is a shared F4milia-wide template; the pipeline steps and review tiers below apply as
written to any product built on it, but the trigger globs are repo-specific. The list below is
KinKeepers' — ported from KINKEEPERS-COMPLETE-RUN-DOC.md's pre-flight section, not the generic
default. Re-derive it per repo rather than copying another product's list.

---

## The pipeline (automated, runs on every PR)

1. Claude Code generates code + tests per the session prompt.
2. PR opens, triggering:
   - **pgTAP suite** — the *stable, protected* isolation tests (a member of one cohort can't read another cohort's posts, no role self-escalates, a partner-org user sees exactly their own organization's referrals) run unchanged on every PR, plus any new pgTAP tests the PR adds for new tables or RLS policies.
   - **ZeroStep** — E2E user-flow validation, path-filtered to `app/**` and `components/**` so backend-only PRs don't wait on browser tests.
   - **CodeRabbit** — diff scan on every PR. Useful signal, not a verdict: diff-only (can't see cross-file or architectural regressions), roughly 44% catch rate per independent benchmark, low noise.
   - **Greptile** — high-stakes PRs only (trigger globs below). Full-codebase context: indexes the whole repo and catches the cross-file breaks CodeRabbit structurally can't. Higher catch rate (~82% benchmarked), noisier — expect to triage some false positives; that's the trade being paid for on purpose.

## The trigger globs (what makes a PR high-stakes)

```
supabase/migrations/**
lib/auth/**
**/rls*
**/zoom/**
**/reminders/**        (or **/messaging/** - match whichever dir P4/X3 actually create)
**/consent/**
**/audit/**
app/admin/**           (broadened from the run doc's app/admin/partners/** now that any
                         admin screen is role-gated + RLS-backed, not just the partners one)
```

Plus, always, regardless of path: anything touching facilitator payouts or compensation
calculations (A4/F3 — parked for now, but treat as high-stakes the moment either runs); any new
AI-to-write path (none exist in KinKeepers today); anything Ivan marks manually in the PR
description.

---

## Step 1: Triage

**High-stakes** — any trigger above fires — Greptile runs — the full path in Step 2b, merge only at 09:30 with Ivan present.

**Low-stakes** — everything else (UI components, copy, wiring to an already-existing table) — Step 2a, merge any time.

New pgTAP tests written in the same pass as the code they test are *always* high-stakes — a test can be green and still validate the wrong behavior if the same generation wrote both.

---

## Step 2a — Low-stakes path

1. Confirm all automated gates passed.
2. Read the diff for basic sanity — is this actually what the session asked for.
3. Merge. Genuinely fast is fine here; this isn't where the risk lives.

---

## Step 2b — High-stakes path: the full Testing/QA + Integration Buffer

**Testing/QA:**

1. Read every line of the diff — understand it, don't skim it. If Claude Code touched a file the session didn't mention, know why before proceeding.
2. Confirm the stable core isolation suite still passes unchanged.
3. Read the *new* tests this PR added — do they test the right thing, not just whether they're green.
4. Triage Greptile's findings — each one is either a real issue (fix-forward now) or a documented false positive (note why, in the PR). Don't dismiss in bulk.
5. Verify the session's **named edge case** by hand — every Greptile-tier session in the run doc names one; that's what gets checked here, not a general vibe pass.
6. For anything touching RLS: one manual check beyond the automated suite — sign in as a member of a different cohort, or as staff from a different partner organization, and try to reach the data directly, watch it fail correctly.

**Integration Buffer:**

7. Merge to a real branch and run a full regression pass, not just this PR's own tests.
8. Confirm CLAUDE.md and BUILD-FORMAT.md rules were followed — RLS not bypassed, no stray custom API route, no invented copy, AI calls server-side with the marker column present.
9. Write down anything that surprised you or was ambiguous in the session prompt — that note feeds back into the run doc as an amendment. Don't silently work around it.
10. Budget this as real time. This is the step a "2-minute sanity check" quietly skips, and it exists because even the best automated reviewer here misses roughly one bug in five.

---

## Calibration — a standing practice, not a one-time test

The first time each *new category* of high-stakes work runs (first RLS migration, first AI-to-write path, first storage policy), time it honestly: clock starts before opening Claude Code, stops when it's genuinely mergeable — full checklist done, not first successful run. Report the elapsed time, whether the generated tests were sufficient, and what the prompt failed to anticipate. That third item becomes a run-doc amendment. Real numbers from real sessions are what estimates get corrected against — never the other way around.
