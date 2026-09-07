# QA — audit-l5-phone-number-and-3g-coverage L5: API integration

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none from `docs/qa/FIXTURES.md` - none of these steps need a signed-in member; the session-expired and offline-cache states are reachable by URL/localStorage manipulation alone.

## Primary check (from the run doc's Named edge-case register)
Every error state must show the phone number inline, retrying from a genuinely-expired session must actually reach sign-in (not loop), and the app must remain usable under real network throttling.

1. Navigate directly to `/sign-in?error=session_expired`.
   **Expect:** "You've been signed out" with "Sign in again to keep going." AND "Call 1-800-555-0142" both visible in the page body, not just reachable via the "Get help now" button.
2. As a real signed-in member (see `docs/qa/FIXTURES.md`), visit Home once so the next-session cache is written, then open DevTools and confirm `localStorage.kk_next_session_cache` has a value. Simulate a data-layer failure (e.g. temporarily point `NEXT_PUBLIC_SUPABASE_URL` at an unreachable host and reload a caregiver page).
   **Expect:** the offline-cache card renders (date/time/join action), and a "Call 1-800-555-0142" line appears beneath it, not just the "Go to Home" link.
3. With no next-session cache present (clear localStorage first), force the same kind of failure on a caregiver page.
   **Expect:** the generic "We couldn't load this" state renders, with a "Try again" button and the phone number both visible.
4. Restore normal connectivity, then click "Try again" from step 3's state.
   **Expect:** the page reloads successfully and shows real content (this is what a full `window.location.reload()` looks like when the underlying issue really was transient).
5. Open Chrome DevTools' Network tab, set throttling to "Slow 3G", and load `/sign-in` fresh.
   **Expect:** the page eventually renders the email field and "Send link" button, and does not hang indefinitely or show a raw timeout/error.

## Regression (previous two sessions)
- [ ] A5 (oversight and queues): the audit log and reminder-failures screens still load correctly - this session's own retry-flow change to the caregiver error boundary is unrelated to admin screens, but both were touched in close succession this same day.
- [ ] P5 (instrumentation): a member's real session-attended/session-missed events still fire correctly when a facilitator submits attendance - unrelated to this session's changes, but worth a quick sanity check since it shares the same underlying Supabase connection this session's offline-simulation step (2 above) temporarily disrupts.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
