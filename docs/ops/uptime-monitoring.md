# Uptime monitoring (P7b)

P7b's own acceptance line: "Uptime alerts fire on a simulated outage." This
records what already exists and how it was verified — not a setup guide,
since the account/monitor already exist and this doesn't need repeating.

## What's monitored

One [UptimeRobot](https://uptimerobot.com) monitor, "KinKeepers — health
check," polls `https://kinkeepers.vercel.app/api/health` every 5 minutes.
That endpoint (`app/api/health/route.ts`, `lib/health/check-health.ts`,
P7a) checks database, auth, and Zoom reachability together in one call and
returns `200` when all three are healthy, `503` otherwise — so this single
monitor covers everything P7b's own prompt names ("the app, the auth flow,
and the Zoom integration"), not three separate checks.

## Where alerts go

Email, to Ivan's real inbox (`developer@f4milia.com`) — confirmed
directly with Ferenz (2026-09-04) that this is genuinely a channel Ivan
reads, not a shared/unread inbox. SMS, voice call, and push notifications
are configured but unchecked (available if a lower-latency channel is
ever needed).

## Verified, not assumed

Confirmed two ways before treating this as done, per this repo's own
"verified, not assumed" standard for acceptance criteria:

1. **A real test alert was sent and received.** UptimeRobot's own
   `Incidents` tab and Ivan's inbox both show a deliberate down→up cycle
   from 2026-08-29 (`TEST: Monitor is DOWN` / `TEST: Monitor is UP`
   emails, both delivered).
2. **Two real production incidents fired and resolved correctly**,
   confirming this isn't only a test-mode capability:
   - 2026-08-29, 00:09–00:49 GMT+8 (39m 50s) — `500 Internal Server Error`
   - 2026-09-02, 21:51–21:56 GMT+8 (5m 5s) — `503 Service Unavailable`

   Both generated matching "Monitor is DOWN" / "Monitor is UP" emails to
   Ivan's inbox at the time.

## Why this wasn't found sooner

This monitor is external SaaS infrastructure with nothing in the
repository referencing it — no code, no env var, no CI step names
UptimeRobot. It was set up directly in Ivan's own account, outside any
session's own PR. P7b's own acceptance criteria looked unmet from a pure
codebase/grep search (this is exactly why it stayed on the "what's left
in Stream B" list for a while) until Ferenz confirmed directly that it
already existed. If this monitor is ever recreated, migrated to a
different service, or its alert destination changes, update this file in
the same PR — it's the only place this fact is recorded.
