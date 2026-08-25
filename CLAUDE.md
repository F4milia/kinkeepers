# KinKeepers UI

KinKeepers is the cohort experience a family caregiver uses after a loved one is diagnosed with
dementia. It's a program a health system enrolls someone into — not a community platform, not a
course, not a social network. This is a separate design surface from F4milia (shared backend
later, nothing shared visually — do not import from `f4milia-web`, no Futura).

The full spec is `kinkeepers-frontend-build.md` at the repo root. This file distills the parts
that must inform every session: who this is for (Part 1.2) and the design system (Part 2). Read
the source doc for copy (Part 3.1), fixtures (Part 3.2), components (Part 3.3), and screen layouts
(Part 3.4) before building anything that touches them.

See `@AGENTS.md` for framework-version notes (auto-managed by `next dev` — do not hand-edit).

## Who this is for — read this before making any UI decision

The primary user is a family caregiver of someone with dementia, typically:

- Aged 50–75, often managing their own presbyopia, arthritis, or tremor.
- Chronically exhausted. Assume reduced working memory and no patience for figuring things out.
- Sometimes in acute distress when they open the app — some sessions happen at 2am after an
  incident.
- Variable digital literacy — some fluent, some using a tablet their daughter set up.
- Grieving someone who is still alive. The register is steadiness, not tragedy and not cheer.

The first audience to see this build is a health system's clinical staff, evaluating whether to
enroll their patients' caregivers. It gets shown in a conference room before a kitchen table —
build like a compliance reviewer will look at it, because one will.

## Hard constraints — non-negotiable

These follow directly from the audience above. Every session must satisfy all of them.

- Base body text is **18px**. Nothing renders below 16px anywhere, including metadata.
- Touch targets are **48×48px minimum**, **56px** for primary actions. Measure, don't assume.
- **WCAG AAA on body text (7:1)**, AA minimum everywhere else. Verify with a tool, never eyeball.
- **No time-based interactions**: no auto-dismissing toasts, no carousels, no hover-only
  affordances.
- **One primary action per screen.** Two things of equal weight means two screens.
- Every destructive action confirms. Every form saves drafts.
- Keyboard operability and screen-reader correctness are requirements, not polish.
- **Dark mode is required**, not optional — nighttime use next to a sleeping spouse is real.
- **No Futura** — its circular `o` and single-story `a` degrade first for aging eyes.
- **`--urgent` is reserved for the 24/7 support path only.** One element per screen, maximum.
  Never validation errors, never notifications.
- **No red on form errors.** Use `--gentle` with an icon and clear text instead.
- **No gamification** — no streaks, badges, progress rings, celebration states.
- **No likes or reactions** — a like is a way to not respond, and responding is the point.
- **No skeleton shimmer** — it reads as instability. Use the `loading` string instead.
- **No emoji, no exclamation points**, no cheerful framing of dementia caregiving.
- **No invented copy.** Every user-facing string must trace to Part 3.1 of the build doc. If a
  string you need isn't there, ask — don't write one. This includes empty states, error text, and
  button labels.

## Copy rules

- Plain language, 8th-grade reading level. No jargon, no clinical terms, no product-speak.
- Never cheerful ("You've got this"), never euphemistic ("passed away" for "died", softening the
  diagnosis). Say "your husband," "the diagnosis," "when he doesn't recognize you."
- Empty states acknowledge reality: "No one has posted this week," not "It's quiet in here!"
- Banned outright: emoji, exclamation points, "Oops," "Uh oh," "Great job," "You've got this,"
  "Awesome," "Whoops."

## Design system (Part 2)

### Typography

| Role | Face | Why |
|---|---|---|
| UI + body | Atkinson Hyperlegible Next | Braille Institute low-vision design, shape-disambiguated characters |
| Headings | Source Serif 4 | Warmth and institutional credibility without preciousness |

Both load via `next/font/google` in `app/layout.tsx`, self-hosted, `display: swap`, preloaded.
`next/font` currently can't find CLS-fallback metrics for "Atkinson Hyperlegible Next" specifically
(it's a newer addition to Google Fonts) — this prints a harmless build-time notice
(`Failed to find font override values`) but does not affect font loading; the font itself loads
and renders correctly. Nothing to fix; don't chase this warning.

Type tokens (`app/globals.css`, exposed as Tailwind utilities `text-h1` … `text-meta`, each
bundling size + line-height + weight — apply alongside `font-heading` or `font-ui`):

| Token | Face | Size (mobile → desktop, 768px+) | Weight | Line height |
|---|---|---|---|---|
| `text-h1` | `font-heading` | 30px → 40px | 600 | 1.2 |
| `text-h2` | `font-heading` | 24px → 30px | 600 | 1.25 |
| `text-h3` | `font-heading` | 20px → 22px | 600 | 1.3 |
| `text-body-lg` | `font-ui` | 19px → 20px | 400 | 1.7 |
| `text-body` | `font-ui` | 18px (fixed) | 400 | 1.7 |
| `text-label` | `font-ui` | 16px (fixed) | 500 | 1.4 |
| `text-meta` | `font-ui` | 16px (fixed) | 400 | 1.4 |

Line height is generous on purpose — tight leading is harder to track for tired, aging readers.
`h1`/`h2`/`h3` elements get their matching size by default via element selectors in
`globals.css`; use the `text-*` utilities directly when you need to decouple visual size from
semantic heading level.

### Color

Not clinical blue-and-white (that's a patient portal — where bad news lives) and not F4milia's
warm paper. Every token is a CSS custom property in `app/globals.css`, redefined under
`:root.dark` — components never hardcode a hex value or write a `dark:` variant for color; the
token itself changes when the `.dark` class is toggled on `<html>`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | `#1F2421` | `#ECEBE4` | body text |
| `--ink-soft` | `#4A524C` | `#B7BEB8` | secondary text, still AA at 18px |
| `--canvas` | `#F4F2ED` | `#141815` | page background, low glare |
| `--surface` | `#FFFFFF` | `#1E2320` | cards |
| `--line` | `#D8D5CC` | `#343B36` | borders |
| `--action` | `#1F5F4B` | `#6FBF9C` | buttons, links, focus |
| `--action-dim` | `#E8F0EC` | `#1B3229` | selected states, avatar backgrounds |
| `--urgent` | `#8C3A2B` | `#D98B76` | 24/7 support path — nowhere else |
| `--gentle` | `#B8874A` | `#D9A968` | attention without alarm (form errors, warnings) |

Available as Tailwind utilities: `bg-ink`, `text-ink`, `border-line`, `bg-action`, `text-action`,
`bg-action-dim`, `bg-urgent`, `text-gentle`, etc. (any `bg-`/`text-`/`border-` prefix + token name).
The dark values above were derived to clear AAA (≥7:1) for `ink`/`ink-soft` against both `canvas`
and `surface` and AA+ for `action` as a text/link color — reverify with a real contrast tool once
real components exist (Session 5 audit), this is a from-scratch derivation, not from the source
doc.

No gradients, no shadows beyond a 1px border. Radius: `rounded-card` (8px) for cards,
`rounded-control` (6px) for controls.

### Layout and motion

- Single column, `max-w-content` (620px). Not a dashboard.
- 8px spacing scale (Tailwind's default 4px step — always use even multiples). `gap-section` /
  `py-section` / etc. give the 40px minimum section gap as a named token.
- Mobile-first. Most use is on a phone, one-handed, often at night.
- Motion: fades only, 200ms (Tailwind's `duration-200`), no movement or scale.
  `prefers-reduced-motion: reduce` is already wired globally in `globals.css` and disables all
  animation/transition duration — don't reimplement this per-component.
- Focus ring is global: `:focus-visible` gets a 3px `--action` outline, 2px offset, defined once
  in `globals.css`. Never write `outline: none` without an equivalent replacement.

## Architecture notes for future sessions

- **Tailwind v4, CSS-first config.** There is no `tailwind.config.ts` — all tokens live in
  `app/globals.css` via `@theme` / `@theme inline` blocks. Color and type tokens use
  `@theme inline` because they reference runtime custom properties (the `.dark` class, the
  768px media query); static tokens (radius, spacing, container width) use plain `@theme`.
  If you need a new token, add the CSS custom property and its `@theme` mapping in
  `globals.css` — don't reach for a JS config file.
- **Dark mode**: class strategy (`.dark` on `<html>`), persisted via the `kk_theme` cookie (not
  localStorage — see `lib/theme.ts`). On first visit with no cookie, a small blocking inline
  script in `<head>` (`themeInitScript`) reads `prefers-color-scheme`, applies the class before
  paint, and writes the cookie so subsequent requests render server-side with no flash.
  `app/layout.tsx` reads the cookie server-side via `next/headers` and sets the class directly on
  first paint whenever a cookie already exists. `components/theme-toggle.tsx` is the only place
  that writes the cookie after initial load.
- **Data layer**: `lib/fixtures/` holds typed mock data (`Cohort`, `CohortMember`, `Facilitator`,
  `Session`, `Post`) populated verbatim from Part 3.2 of the build doc. `lib/data.ts` is what
  screens actually import (`getCohort`, `getCohortMembers`, `getFacilitator`, `getSessions`,
  `getPosts`, `getUpcomingSession`) — when a real API exists, only `lib/data.ts` changes.
  Session dates in the fixtures are concrete ISO dates anchored to a real Tuesday, not the
  relative labels ("next Tuesday") used in the prose of the build doc.
- Tele-Savvy session topics come from licensed curriculum materials and are not cleared for
  display — `Session.topic` stays in the type but is `null` in every fixture. Do not invent
  session titles.
- `program`, `sessionTotal`, and `deliveryFormat` are fields on `Cohort`/`Session`, never
  hardcoded assumptions — other programs (Stress-Busting: 9 sessions, Powerful Tools: 6) will run
  on this same platform.
- No photographs of people anywhere, including avatars — initials only, deterministic per member.
