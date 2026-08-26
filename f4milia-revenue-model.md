# F4milia — Revenue Model & Mentor Compensation

**Companion to:** `trib4l-build-from-zero.md` (the platform will be renamed
F4milia in the frontend; this repo's code and docs haven't been renamed yet
— see the note at the end of this file).
**Owner:** Ivan Rattliff · F4milia
**Status:** v1 — pricing decided, mentor comp proposed, legal items flagged

## 1. Platform take rate

Declining take rate across four rungs. All rates inclusive of payment
processing.

| Tier | Monthly | Take rate | Tenant upgrades at |
|---|---|---|---|
| Free | $0 | 20% | — |
| Growth | $99 | 10% | ~$1,000/mo |
| Scale | $399 | 6% | ~$7,500/mo |
| Owned | $1,199 | 4% | ~$40,000/mo |

**What a tenant pays, always on their best rung:**

| Their monthly member revenue | They pay | Effective rate |
|---|---|---|
| $500 | $100 | 20.0% |
| $1,000 | $199 | 19.9% |
| $3,000 | $399 | 13.3% |
| $10,000 | $999 | 10.0% |
| $25,000 | $1,899 | 7.6% |
| $50,000 | $3,199 | 6.4% |
| $100,000 | $5,199 | 5.2% |

### Why the floor is 4%

Stripe runs 2.9% + $0.30 per transaction. On a $39/month membership that's
3.7% effective; on $100 it's 3.2%. Since rates are inclusive, anything below
roughly 4% loses money on every transaction. The Owned tier's margin comes
from the $1,199 base, not the take.

**Net position at each rung, after processing:**

| Tier | Example tenant revenue | Our gross | Stripe cost | Our net |
|---|---|---|---|---|
| Free | $500 | $100 | ~$19 | ~$81 |
| Growth | $3,000 | $399 | ~$110 | ~$289 |
| Scale | $10,000 | $999 | ~$330 | ~$669 |
| Owned | $50,000 | $3,199 | ~$1,650 | ~$1,549 |

### Why declining rather than flat

Flat 20% has a hard ceiling around $3,500/month in tenant revenue. Above
that, the assembled alternative stack — Circle Business plus Email Hub plus
a CRM plus an ESP, roughly $600–900/month — becomes dramatically cheaper. At
$50,000/month a flat-20% tenant pays $10,000 against a ~$900 alternative.
They leave, and they're exactly the tenants who generate case studies and
referrals.

The declining ladder means:

- **Zero-friction acquisition.** Free tier, no card. We earn only when they
  do — the most persuasive thing we can say to someone pre-launch.
- **Expansion revenue with no sales motion.** Every upgrade is a tenant
  choosing to pay us more so they can pay less. Self-serve, rational, no
  call required.
- **Whales never have a reason to leave.** At $50,000/month they're at
  6.4% all-in — competitive with Whop's ~5.7% and comparable to Circle
  Business once its add-ons and Stripe fees are counted, while also
  replacing the CRM.

### Where we sit in the market

| Platform | Take rate | Monthly | Brings audience? |
|---|---|---|---|
| Whop | ~3% + processing (~5.7% all-in) | $0 | Yes — marketplace |
| Circle | 0.5–2% on top of Stripe | $89–199+ | No |
| Substack | 10% + Stripe (13–16% all-in) | $0 | Yes — network |
| Patreon | 8–12% + processing (12–15% all-in) | $0 | Partial |
| Skool / Kajabi | 0% | $99–399 | No |
| F4milia | 4–20% inclusive | $0–1,199 | No |

Take rates are rent on distribution. Apple charges 30% because they own the
storefront. We own tooling, not demand — which is precisely why the rate has
to fall as tenants grow, and why the entry rung is free.

### The positioning wedge: one number

Inclusive pricing is the sharpest thing we have. The loudest complaint in
this category is stacked, hidden fees — Circle's transaction fee isn't
disclosed on its pricing page, and Whop's platform fee isn't front and
center either. Creators find out on the invoice.

"One number, and it covers everything" is available and nobody is holding
it. **Protect it: never introduce a fee that stacks on top of a published
rate.**

### Member-level freemium is a product requirement

Tenants must be able to offer free membership inside their communities. "The
community IS the funnel" doesn't work without a free rung — otherwise it's a
paywall.

Free members cost us money and generate no take. Bound the cost with
allowances on email sends, storage, and AI calls — **never on member
count.** "No member caps" must stay literally true, because it's a
published promise.

## 2. Mentor compensation — first-party groups

This is a different business from the tenant model and the economics
invert. In the tenant model, the operator brings the audience and keeps
80%+. In first-party mentored groups, we bring the idea, the brand, the
acquisition spend, and the crowd. The mentor brings expertise and hours.
Paying them like a tenant would be paying them for work we did.

### The principle

Split compensation to match what the mentor can actually influence:

- **Acquisition is ours.** We recruited them, we fill the room. A mentor
  shouldn't earn on it.
- **Retention is theirs.** Whether a member stays past month three is
  almost entirely about whether the mentor is good.

So: guaranteed base for the hours, percentage tied to retained revenue —
not gross. A mentor earns 0% on a member's first month and their share on
months two and beyond. Stated operationally: **the percentage applies to
recurring revenue from members with 60+ days tenure.** They get paid for
keeping the room full, not for us filling it.

The base also solves recruiting. Pure rev share means a good mentor earns
nothing for months while we build — so we'd only attract people with no
better options.

### Structure

| Role | Brings | Compensation |
|---|---|---|
| Facilitator | Runs sessions to our curriculum. Not a draw. | Per-session rate only. No share. |
| Mentor | Expertise, shapes program, named in marketing. | Base per session + share of retained revenue |
| Founding mentor | Co-creates the vertical, exclusive to us. | Base + higher share + possible carry in that community line |

Most hires are the middle row. Reserve the third for someone who genuinely
opens a category we couldn't enter alone.

### Target economics

Total mentor comp at 20–30% of community revenue at steady state. Below 20%
we won't keep good people. Above 30% the unit economics break once CAC is
added.

**Worked example — 40 members at $39/month, four sessions monthly:**

| Line | Amount |
|---|---|
| Community revenue | $1,560 |
| Base ($100 × 4 sessions) | $400 |
| Share (12% of ~$1,100 retained) | $132 |
| Total mentor comp | $532 (34%) |

Slightly hot at that size. The base should be set as a floor that stops
mattering as the group scales — at 20 members the mentor is mostly earning
base, at 150 members mostly earning share. Same dollar base, declining as a
percentage.

At 150 members × $39 = $5,850/mo: base $400 + 12% of ~$5,300 retained =
$1,036 total, or 17.7%. Room to raise the share rate at scale if retention
warrants it.

### Payout mechanics — build it into the platform

Mentor splits should be a F4milia feature, not a spreadsheet. Stripe
Connect handles multi-party splits natively and we're already using it for
the tenant take rate.

Build it once for first-party groups, then sell it to tenants who want to
pay their own moderators and coaches. Circle and Skool don't do this. It's
a real differentiator and it costs us one build.

## 3. Legal items — attorney review required

None of these block the site build. All belong in the same conversation
already happening on the contractor agreements.

### 3.1 Mentor misclassification

A mentor who follows our curriculum, on our schedule, under our brand, with
no other clients looks like an employee. Revenue share does not cure this.
It's the same exposure flagged on the Philippines contractors, and it's
worse here because we control the program.

Either build genuine independence markers into the arrangement — mentor
sets their own session format, serves other clients, uses own materials —
or budget for W-2.

### 3.2 Licensure and fee-splitting

If mentored groups are the caregiver vertical, this gets sharp:

- **Licensed mentors** (social workers, nurses, counselors) —
  percentage-of-revenue arrangements can collide with fee-splitting rules
  in healthcare contexts, varying by state and license type.
- **Unlicensed mentors** — the group must be unambiguously peer support,
  not clinical guidance. That framing has to hold in the agreement, the
  marketing, and the mentor's own script. One mentor giving what sounds
  like clinical advice creates exposure the disclaimer won't cover.

### 3.3 Referral conflict — the significant one

If mentored caregiver groups feed LovingNewHome placement referrals, and
placement is paid by facilities, then a mentor earning a percentage sits
inside a structure where a trusted advisor has financial interest in
families choosing placement.

That is the exact shape regulators examine in senior care referral. Minimum
requirements:

- Clear, plain-language disclosure to members that placement referral is a
  paid relationship
- A firewall between the mentor role and referral revenue — the mentor's
  compensation must not vary with placement outcomes
- Written policy on what a mentor may and may not say about placement

Resolve before the first group runs, not after.

### 3.4 Merchant of record

Collecting member fees internationally means choosing:

- **Stripe Connect Express** — tenant is MoR and owns their tax exposure.
  Simpler. Start here.
- **F4milia as MoR** — we handle global VAT and digital-goods sales tax.
  Genuinely hard, but becomes a premium selling point later.

### 3.5 Rate change rights

Reserve the right to adjust take rates with notice, and grandfather the
first 50 tenants at their rate permanently. Costs almost nothing at that
scale, buys evangelists, and gives cover to raise rates later without
backlash.

## 4. Operating discipline

### Leakage is what kills take-rate businesses

At 20%, a tenant doing $10,000/month saves $2,000 by taking payments
off-platform. They will try. Three defenses, in order of effectiveness:

1. Make the CRM, automation, and segmentation run on payment data. If they
   route around our rail, their funnel breaks. This is the real lock — and
   it's the Aksumite point: own the measurement layer, not the transaction.
2. Make on-platform payment genuinely better. Instant payouts, failed-card
   recovery, one-click member checkout.
3. Anti-circumvention language in the terms. Weakest of the three. Backstop,
   not strategy.

### The four numbers to instrument from day one

| Metric | Why |
|---|---|
| GMV processed | The top line the whole model rests on |
| Blended take rate | Tells us where tenants actually cluster on the ladder |
| Net revenue retention | Compounds without upsell — target >115% |
| GMV concentration in top 10 tenants | The risk metric. Take-rate businesses die when one whale leaves. |

### Activation is first dollar collected

Not first community launched. A tenant with zero paid members is pure cost
and consumes support. Optimize onboarding for time-to-first-paid-member and
make it the north star.

### Sequencing

Launch with the free tier only. Ship it, watch where tenants cluster, then
introduce paid rungs with real data. Free → tiered is easy. Tiered → free
is a repricing mess.

---

## Reconciliation notes against the build plan

Flagged while reading this alongside `trib4l-build-from-zero.md` — not
acted on, since no Session past 1 has touched commerce yet and the build
plan itself says changing a locked decision is still "iteration, not
rework" before Session 6:

- **Stripe Connect account type conflicts.** The build plan's locked
  decision (§1) is **Standard** accounts with **direct charges**. This doc
  (§3.4) recommends starting with **Express**, tenant as merchant of
  record. Standard vs. Express changes what onboarding UX and dashboard
  access the tenant gets; both keep the tenant as MoR under direct charges,
  so they're not actually incompatible, but this needs an explicit decision
  before Session 13 (Connect onboarding), not a default carried over from
  whichever doc gets read first.
- **Take-rate tiers and Stripe's `application_fee_amount`.** The four-rung
  declining rate (§1) needs to be a live lookup against the tenant's current
  rung at charge time, not a static config value — Session 14's checkout
  and Session 19's revenue-ops dashboard both depend on this being modeled
  as real schema (a `platform_billing_plans` or equivalent table with an
  effective-rate function), not a hardcoded constant.
- **Mentor payout splits via Stripe Connect** (§2) is new scope beyond what
  Session 9 (mentorship) or Session 16 (benefits marketplace) currently
  describe — mentorship in the build plan is about pairing lifecycle, not
  payment. This adds a real payments dependency to Session 9 that the
  original plan didn't have, or it becomes a Session 16-adjacent addition.
  Worth resolving which session owns it before that session starts.
- **§3.3 (referral conflict)** bears directly on the build plan's open
  question 1 ("which company is this — placement agency, or community
  platform with placement as a benefit?"). This doc assumes the answer is
  "community platform with placement as a paid referral," which makes that
  open question closer to answered — worth confirming explicitly rather than
  letting it default that way through two separate docs.
- **New legal open items** (§3.1, §3.2, §3.5) belong alongside the build
  plan's own §5 "Still open, still yours" list — attorney review before
  Session 9 (mentor pairing) for 3.1/3.2, and before Session 13 (Connect
  onboarding) for 3.4/3.5.

## Naming note

This doc and the build plan both predate the site rename from Trib4l to
F4milia. Per instruction, no code, config, or existing doc has been renamed
yet — this file is kept as given, and the rename gets applied when frontend
branding work happens. Until then, `organizations.name` /
`organizations.slug` and all repo/package naming stay "Trib4l."
