# KinKeepers — Frontend Build

**Everything you need, in the order you need it.**

For: James Jarin · Owner: Ivan Rattliff · Repo: `kinkeepers-ui`

This replaces `kinkeepers-frontend-brief.md` and `kinkeepers-demo-kit.md`. Work top to bottom. Parts 1 and 2 are reading; Part 3 onward is reference you'll come back to; Part 4 is the build.

---

# PART 1 — What you're building and who it's for

## 1.1 The project

KinKeepers is the cohort experience a family caregiver uses after a loved one is diagnosed with dementia. It's a program a health system enrolls someone into — not a community platform, not a course, not a social network.

**Build against mocked data.** The backend doesn't exist. Every screen renders from typed fixtures. When the API lands we swap the data layer and components don't change — structure for that from session 0.

**This is a separate surface from F4milia.** Shared backend later, entirely separate design language. Do not import anything from `f4milia-web`. No Futura.

**The first audience is a health system's clinical staff**, evaluating whether to enroll their patients' caregivers. This gets shown in a conference room before a kitchen table.

## 1.2 Who uses this — the whole design brief

Everything in Part 2 follows from this section. Read it twice.

The primary user is a family caregiver of someone with dementia. Typically:

- **Aged 50–75.** Often managing their own presbyopia, arthritis, or tremor. Roughly 30% of dementia caregivers are Medicare beneficiaries themselves.
- **Exhausted.** Chronic sleep deprivation is near-universal. Assume reduced working memory and no patience for figuring things out.
- **Sometimes in acute distress when they open the app.** Some sessions happen at 2am after an incident.
- **Variable digital literacy.** Some are fluent; some are using a tablet their daughter set up.
- **Grieving someone who is still alive.** That's the register. Not tragedy, not cheer — steadiness.

### Hard constraints that follow

- Base body text **18px**. Nothing below 16px anywhere, including metadata.
- Touch targets **48×48px minimum**, **56px** for primary actions.
- **WCAG AAA on body text** (7:1), AA minimum elsewhere. Verified with a tool, never eyeballed.
- **No time-based interactions.** No auto-dismissing toasts, no carousels, no hover-only affordances.
- **One primary action per screen.** Two things of equal weight means two screens.
- Every destructive action confirms. Every form saves drafts.
- Keyboard operability and screen-reader correctness are requirements, not polish. Some users are visually impaired.
- **Dark mode is required.** Nighttime use is common; a bright screen at 3am beside a sleeping spouse is a real problem.

### Copy rules

- Plain language, 8th-grade reading level. No jargon, no clinical terms, no product-speak.
- Never cheerful about the situation. No "You've got this", no emoji, no exclamation points.
- Never euphemistic either. Say "your husband", "the diagnosis", "when he doesn't recognize you." Softening it insults the user.
- Empty states acknowledge reality: "No one has posted this week" — not "It's quiet in here!"

**You don't write user-facing copy.** Every string is in Part 3.1. If you need one that isn't there, ask. Don't invent it — the constraints above are strict enough that improvised copy violates them without meaning to.

### Things that would be actively wrong

No gamification. No streaks, badges, progress rings, or celebration states. No likes or reactions — a like is a way to not respond, and responding is the point. No skeleton shimmer; it reads as instability.

---

# PART 2 — Design system

Deliberately different from F4milia. Justify choices against Part 1.2, not against taste.

## 2.1 Typography

| Role | Face | Why |
|---|---|---|
| UI + body | **Atkinson Hyperlegible Next** | Designed by the Braille Institute for low-vision legibility. Characters disambiguated by shape, not weight. Free on Google Fonts. |
| Headings | **Source Serif 4** | Warmth and institutional credibility without preciousness. Reads trustworthy to a clinician, human to a caregiver. |

```css
:root {
  --font-ui: "Atkinson Hyperlegible Next", system-ui, sans-serif;
  --font-heading: "Source Serif 4", Georgia, serif;
}
```

**No Futura.** Its circular `o` and single-story `a` are the first letterforms to degrade for aging eyes. Right for F4milia, wrong here.

| Token | Face | Size (desktop / mobile) | Weight | Line height |
|---|---|---|---|---|
| `--type-h1` | Serif | 40px / 30px | 600 | 1.2 |
| `--type-h2` | Serif | 30px / 24px | 600 | 1.25 |
| `--type-h3` | Serif | 22px / 20px | 600 | 1.3 |
| `--type-body-lg` | UI | 20px / 19px | 400 | 1.7 |
| `--type-body` | UI | 18px / 18px | 400 | 1.7 |
| `--type-label` | UI | 16px | 500 | 1.4 |
| `--type-meta` | UI | 16px | 400 | 1.4 |

Line height is generous on purpose. Tight leading is harder to track for tired and aging readers.

## 2.2 Color

Not clinical blue-and-white — that's a patient portal, and patient portals are where bad news lives. Not F4milia's warm paper either.

```css
:root {
  --ink:        #1F2421;  /* body text */
  --ink-soft:   #4A524C;  /* secondary text, still AA at 18px */
  --canvas:     #F4F2ED;  /* page, low glare */
  --surface:    #FFFFFF;  /* cards */
  --line:       #D8D5CC;  /* borders */
  --action:     #1F5F4B;  /* buttons, links, focus */
  --action-dim: #E8F0EC;  /* selected states, avatar backgrounds */
  --urgent:     #8C3A2B;  /* 24/7 support path ONLY */
  --gentle:     #B8874A;  /* attention without alarm */
}
```

- `--urgent` is **only** the 24/7 support path. One element per screen maximum. Never validation errors, never notifications. If everything can be urgent, nothing is.
- **No red on form errors.** Use `--gentle` with an icon and clear text. A red error at 2am on a screen about your spouse's dementia lands harder than it should.
- No gradients, no shadows beyond a 1px border.
- Radius 8px cards, 6px controls.

Every token needs a dark value. Build both from session 0.

## 2.3 Layout and motion

- **Single column, max 620px.** A reading and responding interface, not a dashboard. Do not build a three-column app shell.
- 8px spacing scale, section gaps 40px minimum.
- Mobile-first. Most use is on a phone, often one-handed, often at night.
- **Motion:** fades only, 200ms, no movement or scale. `prefers-reduced-motion` disables everything.

---

# PART 3 — Content and components

Reference material. You'll come back to this during every session.

## 3.1 Copy deck

Every user-facing string. Verbatim.

### Navigation
| Key | String |
|---|---|
| `nav.home` | Home |
| `nav.cohort` | My group |
| `nav.discussion` | Discussion |
| `nav.support` | Get help now |

### Home
| Key | String |
|---|---|
| `home.greeting` | Hello, {firstName} |
| `home.next_meetup` | Your next meeting |
| `home.join_video` | Join by video |
| `home.get_directions` | Get directions |
| `home.cant_attend` | Let your group know you can't make it |
| `home.progress` | Session {n} of {total} |
| `home.recent` | Recent from your group |
| `home.view_all` | See all discussion |
| `home.empty_meetup` | No meetings scheduled yet. Your facilitator will add the next one. |
| `home.empty_posts` | No one has posted this week. |

### Support sheet
| Key | String |
|---|---|
| `support.title` | Get help now |
| `support.body` | Someone from the care team is available any time, day or night. Call and a person will answer. |
| `support.call` | Call {phoneNumber} |
| — | **Placeholder value: `1-800-555-0142`.** The 555-01XX range is reserved for fictional use, so a demo tap can't reach a real person. Do not substitute a realistic-looking number. |
| `support.note` | If this is a medical emergency, call 911. |
| `support.close` | Close |

### My group
| Key | String |
|---|---|
| `cohort.title` | My group |
| `cohort.subtitle` | {n} people, meeting {cadence} |
| `cohort.facilitator_label` | Facilitator |
| `cohort.caring_for` | Caring for {relationship} |
| `cohort.empty` | Your group is still forming. |

### Discussion
| Key | String |
|---|---|
| `discussion.title` | Discussion |
| `discussion.compose_placeholder` | Share something with your group |
| `discussion.post` | Post |
| `discussion.reply` | Reply |
| `discussion.reply_placeholder` | Write a reply |
| `discussion.draft_saved` | Draft saved |
| `discussion.empty` | No posts yet. You can be the first. |
| `discussion.replies_one` | 1 reply |
| `discussion.replies_many` | {n} replies |

### Session detail
| Key | String |
|---|---|
| `session.attending` | {n} people attending |
| `session.topic` | What we'll cover |
| `session.materials` | Materials |
| `session.mark_absent` | I can't make this one |
| `session.marked_absent` | You've let your group know you can't attend. |
| `session.undo_absent` | Actually, I can attend |
| `session.past_notes` | What we covered |
| `session.location_video` | By video |
| `session.location_person` | In person |

### Facilitator log
| Key | String |
|---|---|
| `log.title` | Session log |
| `log.confirm_delivery` | Confirm this session took place |
| `log.attendance` | Attendance |
| `log.present` | Present |
| `log.absent` | Absent |
| `log.excused` | Excused |
| `log.unmarked` | Not marked |
| `log.notes` | Session notes |
| `log.notes_placeholder` | What was covered, and anything the care team should know |
| `log.submit` | Submit log |
| `log.confirm_title` | Submit this session log? |
| `log.confirm_body` | This becomes part of the service record. You can edit it later, and edits are recorded. |
| `log.confirm_yes` | Submit log |
| `log.confirm_cancel` | Keep editing |
| `log.submitted_by` | Logged by {name} on {date} |
| `log.edited_by` | Edited by {name} on {date} |
| `log.previous_value` | Previously: {value} |
| `log.unmarked_warning` | {n} people are not marked. |

### Errors and system
| Key | String |
|---|---|
| `error.required` | This can't be empty. |
| `error.too_long` | This is too long. Try shortening it. |
| `error.load_failed` | We couldn't load this. Try again. |
| `error.retry` | Try again |
| `loading` | Loading… |
| `theme.light` | Light |
| `theme.dark` | Dark |

**Never permitted:** emoji, exclamation points, "Oops", "Uh oh", "Great job", "You've got this", "Awesome", "Whoops", or any cheerful framing.

## 3.2 Fixtures

Use as written. Fixture quality is the difference between a demo that lands and one that looks like a template. **All content is fictional; no real person is depicted.**

### Cohort

**Nationwide, video-first.** Cohorts are grouped by relationship and stage, not geography — that's the core product advantage and the fixture should show it.

```
id: "cohort-001"
name: "Spouses, Early Stage — Tuesday Evenings"
grouping: "Spouses caring for a partner in early-stage dementia"
program: "Tele-Savvy"
cadence: "every Tuesday"
timeZoneLabel: "6:30 PM Eastern"
capacity: 12
status: "active"
sessionNumber: 4
sessionTotal: 6
deliveryFormat: "video"
```

**The program is Tele-Savvy** — 6 Zoom-based group sessions over 6 weeks, 90–120 minutes each, deliverable by a lay leader. Zoom-native by design, which is why it beats Savvy Caregiver for a nationwide video-first program. Copy says "Session 4 of 6", not "Week 4 of 12".

`program`, `sessionTotal`, and `deliveryFormat` are all fields, never hardcoded. We will run other programs on this platform — Stress-Busting is 9 sessions, Powerful Tools is 6 — and a component that assumes six will break on the second cohort.

No street address, no room number. The primary action on a session is **Join by video**, not Get directions.

Keep `deliveryFormat` in the model with an `in_person` variant — some health systems will want local cohorts and the component shouldn't need rewriting when they do.

### Members

| First name | Caring for | Role |
|---|---|---|
| Denise | her husband | facilitator |
| Rosalind | her husband | member |
| Terry | his wife | member |
| Paul | his wife | member |
| Hector | his wife | member |
| Marilyn | her husband | member |
| Curtis | his wife | member |
| Yvonne | her husband | member |
| Bernadette | her husband | member |
| Arthur | his wife | member |

**All spouses** — that's the point of the cohort. A relationship-grouped roster reads immediately as intentional, and it's the single clearest signal in the demo that this isn't a generic support group. Members are nationwide; no locations shown.

### Posts

**Post 1 — Rosalind, 2 days ago**
> He asked me who I was on Sunday. Not in a confused way, just plainly, like meeting someone. I said I was his wife and he said that was nice. I don't know what to do with that. I made dinner after and it was fine. That's the part nobody tells you, that it's fine after.

> **Terry, 2 days ago** — The first time is the worst. It happened to me in March. It happens again and it doesn't get easier exactly but you get less surprised.

> **Denise (facilitator), 1 day ago** — Rosalind, thank you for putting that here. We're going to talk about this Tuesday — it's what week five is about. You don't have to have anything figured out before then.

**Post 2 — Terry, 4 days ago**
> Practical question. My wife has started refusing to shower. Not arguing, just won't. Her sister thinks I should insist. I don't want to force her and I also don't want her sitting in the same clothes for four days. Has anyone found something that works.

> **Marilyn, 4 days ago** — We moved it to mornings and stopped calling it a shower. My husband will get in if I say we're getting ready for the day. Took a few weeks to land on that.

> **Yvonne, 3 days ago** — Warm the bathroom first. Mine was cold and couldn't say so.

**Post 3 — Paul, 6 days ago**
> I put her in respite for two days last week and I felt guilty the entire time. Slept eleven hours the first night. Not sure what I'm asking here.

> **Bernadette, 5 days ago** — You're not asking anything. You're allowed to just say it.

### Sessions

**Upcoming** — next Tuesday 6:30 PM Eastern, 120 min, **by Zoom**, session 5 of 6, 7 confirmed, 1 handout

**Past** — last Tuesday, session 4 of 6, 8 present / 1 absent / 1 excused, notes logged by Denise

**Past** — two Tuesdays ago, session 3 of 6, 9 present / 1 excused

Show the time zone on every session. Nationwide cohorts span four of them and "6:30 PM" alone is ambiguous in a way that will cause someone to miss a meeting.

⚠️ **Do not invent session titles.** Tele-Savvy's session topics come from licensed curriculum materials and may be protected. For the demo, label sessions by number only — "Session 5" — with the topic field left empty. Real titles go in once the license is in hand and we have confirmed they can be displayed publicly.

The `topic` field stays in the model. It is simply null in the fixtures.

### Avatars

**No photographs of people.** Not stock, not AI-generated faces, not placeholder services that serve real portraits. A demo shown to a health system can't contain a real person's likeness without rights.

Initials in a circle: `--action-dim` background, `--ink` letter, `--type-label` weight 500. Deterministic per member so they stay consistent. Reads intentional rather than unfinished.

## 3.3 Components

Build these before any screen. Every state listed.

| Component | States |
|---|---|
| `Button` | primary, secondary, quiet, destructive · default, hover, focus, active, disabled, loading |
| `Avatar` | 32 / 40 / 56px · initials only |
| `Card` | default, interactive (hover + focus) |
| `Sheet` | bottom on mobile, centered dialog on desktop · focus trap, escape close, backdrop close, scroll lock |
| `TextArea` | default, focus, error, disabled · autosave indicator, character limit |
| `RadioGroup` | attendance · unmarked is a real state, not a default |
| `TabBar` | mobile bottom bar, desktop left rail · active, focus |
| `Badge` | neutral, gentle, urgent |
| `EmptyState` | headline + body, no illustration |
| `ConfirmDialog` | confirm is never the default focus |
| `ThemeToggle` | light, dark · persists via cookie |
| `Skeleton` | **don't build.** Use the `loading` string. |

**Focus ring everywhere:** 3px `--action`, 2px offset, visible on keyboard focus. Never `outline: none` without a replacement.

## 3.4 Screen layouts

Vertical order, top to bottom. Single column, 620px max.

**Home** — greeting + theme toggle · next-meeting card (day and time large, location, one primary action, quiet "can't make it") · program position, one line · "Recent from your group", two posts max, truncated and tappable · quiet "See all discussion" · support affordance, persistent, never scrolls out of reach

**My group** — title + subtitle showing the grouping ("Spouses caring for a partner in early-stage dementia · 10 people, every Tuesday") · facilitator first with role badge · members one per row: avatar, first name, "Caring for her husband" · no row actions, read-only by design · no locations shown

Render every time in the viewer's local zone with the zone labeled — "6:30 PM Eastern (3:30 PM your time)". Cohorts span four time zones and an unlabeled time will make someone miss a meeting.

**Discussion** — title · composer collapsed to one line until focused · posts newest first with avatar, first name, relative time, full body, reply count · replies indented **one level only** · reply composer inline on tap, not a modal

**Session detail** — week and topic as heading · date, time, duration · location with in-person/video badge · "7 people attending", count only · "What we'll cover" · materials · primary action (Join / Directions) · quiet "I can't make this one". Past sessions swap the last two for "What we covered."

**Facilitator log** — week, topic, date · **explicit** confirm-delivery control, not implied by submitting · attendance list, every member, three-state radio, unmarked visibly unmarked · unmarked warning in `--gentle`, non-blocking · notes textarea · submit → confirm dialog · below, if previously submitted: "Logged by Denise on {date}" plus edit history with prior values still legible

The facilitator log carries the most weight in the demo. Build it last, build it carefully.

---

# PART 4 — Build sessions

Fresh Claude Code session each. Commit at the end of each. Don't chain them.

## Session 0 — Scaffold and tokens

```
Read Parts 1 and 2 of this document in full before starting. The audience
constraints in 1.2 drive every decision and are not negotiable.

Scaffold Next.js 15 (App Router, TypeScript, Tailwind) named kinkeepers-ui.
Deploying to Vercel.

1. Translate Part 2 typography, color, and layout into Tailwind config and
   globals.css. Every value becomes a named token. No raw hex after this
   session.

2. Fonts: Atkinson Hyperlegible Next and Source Serif 4 via
   next/font/google. Preload both, font-display: swap.

3. Dark mode from the start, not retrofitted. Every color token gets a dark
   value. Class strategy, respect prefers-color-scheme on first load, user
   override via persistent toggle. Store the preference in a cookie, not
   localStorage.

4. Set up /lib/fixtures with TypeScript types for Cohort, CohortMember,
   Session, Post, Facilitator. Populate from Part 3.2 exactly as written.

   Expose data access as functions (getCohort, getSessions) that currently
   read fixtures, so swapping to an API later touches only those functions.

5. Write CLAUDE.md capturing Parts 1.2 and 2. Include the hard constraints
   explicitly: 18px base, 48px targets (56px primary), AAA body contrast, no
   time-based interactions, no Futura, --urgent reserved for 24/7 support,
   no red errors, no gamification, no likes, no skeleton shimmer, no emoji,
   no exclamation points, no invented copy.

Do NOT build screens this session.

Acceptance: npm run build clean. A test page shows heading in Source Serif
and body in Atkinson at 18px. Toggling dark mode changes every color with no
hardcoded values surviving.

Commit: "chore: scaffold, tokens, fixtures"
```

## Session 1 — Components

```
Read CLAUDE.md and Part 3.3.

Build every component in the Part 3.3 table with all listed states. No
screens this session — screens compose these, and building them in the wrong
order produces inconsistency you'll be chasing for the rest of the project.

Primary buttons are 56px tall. Everything else interactive is 48px minimum.
Measure, don't assume.

Focus ring on every interactive component: 3px --action, 2px offset, visible
on keyboard focus. Never outline: none without a replacement.

Do not build Skeleton. Use the `loading` string from Part 3.1.

Build a /components page (dev-only route) rendering every component in every
state, in light and dark. This is how we review them and how you catch a
missing state.

Acceptance: /components shows all states in both modes. Every target
measured and passing. Keyboard focus visible on every interactive element.
No hardcoded colors or strings.

Commit: "feat: component library"
```

## Session 2 — App shell and Home

```
Read CLAUDE.md and Parts 3.1, 3.4.

SHELL
Single column, 620px max. Bottom tab bar on mobile, left rail on desktop.
Three destinations: Home, My group, Discussion.

The 24/7 support affordance is persistent and reachable without scrolling.
It uses --urgent and is the only element that does. Tapping opens a sheet
with the phone number as a tel: link and the Part 3.1 support strings. No
form, no chatbot, no triage questions — someone in crisis at 2am gets a
phone number.

HOME
Per Part 3.4. One primary action on this screen: the meeting action.
Everything else is quiet.

No stats, streaks, progress rings, or badges. Gamifying a dementia
caregiving program would be grotesque and clinical reviewers will notice.

Empty states from Part 3.1 verbatim.

Acceptance: 320px to 1440px. Body contrast 7:1 verified with a tool in both
modes. Full keyboard traversal, focus visible. Screen reader announces the
support affordance clearly.

Commit: "feat: app shell and home"
```

## Session 3 — My group and Discussion

```
Read CLAUDE.md and Parts 3.1, 3.2, 3.4.

MY GROUP
Roster per Part 3.4. First name, avatar initials, role, relationship. No
last names, no email, no phone — this is a face-recognition aid, not a
directory. Privacy here is a design requirement, not an oversight.

Facilitator is labeled, not elevated to a hierarchy.

DISCUSSION
Threaded posts, cohort-scoped. Plain text composer only — no rich text, no
attachments, no formatting toolbar.

Drafts autosave and survive a closed tab. This population gets interrupted
mid-sentence constantly; losing a post someone worked up the energy to write
is a reason to stop using the product.

Replies indent one level only. Deeper nesting is unreadable at 18px on a
phone.

No reactions, no likes, no counts. A like is a way to not respond, and
responding is the point.

Use the Part 3.2 post content exactly as written.

Acceptance: composer autosaves and restores after a hard refresh. Long posts
and long names don't break layout. Keyboard operable end to end. AAA
contrast both modes.

Commit: "feat: cohort roster and discussion"
```

## Session 4 — Session detail and facilitator log

```
Read CLAUDE.md and Parts 3.1, 3.4.

SESSION DETAIL (caregiver view)
Per Part 3.4. Include a plain way to say they can't attend — no guilt in the
copy, use the Part 3.1 strings and nothing more.

FACILITATOR LOG
Scope decision: this is a CONVENIENCE LAYER over the health system's own
documentation. It is NOT the clinical record of evidence for CMS. They
document in their systems; we make the facilitator's job easier and produce
something exportable.

What that means for the build:
  - No retention policy, no HIPAA-grade handling, no PHI beyond first names
  - No claim anywhere in the UI that this satisfies a reporting requirement
  - Export is a nice-to-have, not this session

What it does NOT relax: mentor payouts calculate against this log, so it is
still a FINANCIAL record. Audit trail and edit history stay exactly as
specced. A facilitator disputing a payout must be able to see what was
logged and when.

Treat it as a record, not a form:
  - Show what was logged, when, and by whom
  - An edit is visibly an edit, with the prior value still legible
  - Confirmation before submitting — this is a financial and compliance
    record, not a preference

Attendance is explicit per member: present, absent, excused. No implicit
defaults. An unmarked member reads as unmarked, never as absent.

Also build a dev-only view switcher between caregiver and facilitator. This
is demo scaffolding, not a product feature — keep it visually obvious that
it's scaffolding.

Design this to survive a compliance reviewer looking at it, because one
will.

Acceptance: submission requires confirmation. Edit history visible and
readable. Attendance unambiguous for every member. Keyboard operable. AAA
contrast both modes.

Commit: "feat: session detail and facilitator log"
```

## Session 5 — Audit

```
Read CLAUDE.md and Parts 1.2, 2, 3.1. This is an audit. Do not add features.

Report findings before fixing.

AUDIENCE CONSTRAINTS
  - Grep for font-size below 16px. Body must be 18px.
  - Measure every interactive target: 48px min, 56px primary.
  - Verify body contrast 7:1 in BOTH modes with a tool.
  - Confirm no auto-dismissing toasts, carousels, or hover-only
    affordances.
  - Confirm one primary action per screen.
  - Confirm destructive actions confirm and forms save drafts.

DESIGN SYSTEM
  - Grep for Futura or Jost. Zero hits.
  - Confirm --urgent appears only on the 24/7 support path.
  - Confirm no red on validation errors.
  - Grep raw hex outside the token file. None.
  - Confirm dark mode covers every surface.
  - Confirm no Skeleton component exists.

COPY
  - Grep for hardcoded user-facing strings. Every string must trace to
    Part 3.1.
  - Grep for emoji and exclamation points. Zero.
  - Grep for "You've got this", "Great job", "Awesome", "Oops", "Uh oh",
    "Whoops".
  - Read every empty state aloud. Any that sound cheerful about dementia
    caregiving are bugs.

ACCESSIBILITY
  - Full keyboard traversal, visible 3px --action focus ring throughout.
  - Test with VoiceOver or NVDA on Home and the facilitator log minimum.
  - Sequential heading hierarchy, no skipped levels.
  - Every image has meaningful alt text or is aria-hidden.
  - prefers-reduced-motion disables all animation.

PERFORMANCE
  - Lighthouse Accessibility 100 — not 98, 100. Performance 95+.
  - LCP under 2.0s on 4G. CLS under 0.05.

Flag anything needing a design decision rather than deciding it.

Commit: "fix: accessibility and compliance audit"
```

---

# PART 5 — Demo readiness

## 5.1 The click path

The demo has one job: make a clinical reviewer believe this could hold a real cohort.

1. **Home** — the next meeting is concrete. A specific room, a specific Tuesday.
2. **Tap support** — a phone number and a sentence. 24/7 access is a real path, not a form.
3. **Discussion** — read Rosalind's post. This is where the demo works or doesn't. Real caregiver language does more than any feature.
4. **Session detail** — session 5 of 6, by Zoom, seven confirmed.
5. **Switch to facilitator → session log** — attendance, notes, edit history. This answers "how would we document this for CMS."

## 5.2 Demo-ready checklist

- [ ] All five screens render from fixtures, zero console errors
- [ ] Every string traces to Part 3.1 — grep for hardcoded text
- [ ] Zero emoji, zero exclamation points
- [ ] Zero photographs of people
- [ ] Light and dark both complete, no hardcoded colors
- [ ] Every target measured: 48px min, 56px primary
- [ ] Body contrast 7:1 verified both modes
- [ ] Full keyboard traversal of the click path, focus visible throughout
- [ ] VoiceOver or NVDA pass on Home and facilitator log
- [ ] Lighthouse Accessibility **100**, Performance 95+
- [ ] Renders 320px to 1440px
- [ ] Deployed to a Vercel preview URL that works on Ivan's phone
- [ ] The five-step path runs start to finish with no dead end

Last item matters most. A demo that breaks on step four is worse than no demo.

## 5.3 Not in this build

Say no when these come up: authentication, real API integration, notifications, email or SMS, video calling (link out), resource library, admin or health-system reporting views, anything from the F4milia design system.

---

# PART 6 — Resolved

| # | Question | Answer |
|---|---|---|
| 1 | Curriculum | **Tele-Savvy**, conditional on terms. Licensed from BPC, not authored. See below. |
| 2 | 24/7 number | **`1-800-555-0142`** placeholder. Fictional range, safe to tap. Nationwide. |
| 3 | Facilitator log | **Convenience layer**, not the CMS record. Lighter build — see session 4. |
| 4 | Name and domain | **KinKeepers**, `kinkeepers.health`. |

## Curriculum — Tele-Savvy, conditional on terms

| | |
|---|---|
| Format | 6 Zoom-based group sessions |
| Length | 6 weeks, 90–120 min each |
| Delivered by | **Lay leader**, professional, or paraprofessional |
| Languages | English, Spanish, Chinese |
| Developers | Hepburn, Lewis, Wexler Sherman, Tornatore, Dolloff — same team as Savvy Caregiver |
| Source | Best Programs for Caregiving — `bpc.caregiver.org` |

Lay-leader delivery is the key attribute: no clinical licensure requirement, lower facilitator cost, and it removes the fee-splitting concern around percentage-based facilitator comp.

⚠️ **Commercial terms are NOT settled.** Savvy Caregiver's pricing came back prohibitive, and Tele-Savvy is from the same developers — assume similar structure until proven otherwise. The build proceeds on this assumption because the fixture impact is one field, but **do not print this program name on anything external until terms are signed.**

**Decision rule:**

| Terms | Action |
|---|---|
| Trainer fees only + train-the-trainer rights | Go. Tele-Savvy. |
| Trainer fees only, no internal certification | Get the per-trainer number, model 20 facilitators, then decide |
| Per-cohort or per-participant fees | Pivot to Powerful Tools |

A per-trainer fee is still a scaling cost — 20 facilitators nationwide means 20 fees plus turnover. It is only cheap if internal certification collapses it after the first cohort.

**The term that decides it: train-the-trainer rights.** If we can certify our own facilitators after an initial cohort, marginal cost per facilitator collapses and we control our growth rate. If every facilitator must go through the developer, they are a permanent bottleneck and hold pricing power over us indefinitely.

**Fallback candidates**, all group + online + lay-leader deliverable: Powerful Tools for Caregivers (6 sessions), Stress-Busting Program (9 sessions, lay leader only), ACES (4 sessions). Any of these is a one-field change to the fixtures.

**Why licensing beats authoring:** a clinical reviewer who sees "Tele-Savvy" knows what it is and moves straight to evaluating delivery. A reviewer who sees "our 6-week curriculum" has to evaluate an unvalidated program first, and that conversation is longer and ends worse.

### Programs are stackable — build for it

Of the 49 programs in BPC, most are one-on-one; only about a dozen support group delivery online. That subset is the whole competitive field, and these three stack:

| Sequence | Program | Sessions | Delivered by |
|---|---|---|---|
| Entry | Tele-Savvy | 6 | Lay leader |
| Then | Stress-Busting Program | 9 | Lay leader only |
| Or | Powerful Tools for Caregivers | 6 | Lay leader |

A caregiver who finishes a 6-session program and moves into Stress-Busting is fifteen weeks of engagement instead of six. **This is why `program` and `sessionTotal` are fields and never constants.**

### Still to confirm before the pilot

- **License cost.** BPC has a "Cost or fee to obtain license" filter — run it. A $0 program with equivalent outcomes is free margin.
- **Facilitator certification** — what training is required, how long, what it costs.
- **Whether session titles can be displayed** publicly or only inside licensed materials.
