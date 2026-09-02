# QA — L3 (PR2/2) Notification preferences and account

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: Jamie Ellis (real, sign-in-able member account, `docs/qa/FIXTURES.md`)

## Primary check (from the run doc's Named edge-case register)
L3's acceptance line: "Preference changes take effect on the next reminder. Deletion and export requests create queue items with on-screen confirmation." Verify a member can actually change their own contact info and notification channel, and that both data-request buttons are directly visible (not behind a settings submenu) and confirm on screen.

1. Go to `/sign-in`, enter `ferenz+kinkeepers-member@brandlamb.com` (Jamie Ellis), open the email that arrives at that real inbox, and click the sign-in link.
   **Expect:** signed in, landing on the caregiver Home screen.
2. Click "Account" in the header (top of every caregiver screen, next to the theme toggle and "Get help now" - not a fourth tab-bar destination).
   **Expect:** the Account screen loads with Jamie's real name, contact email, and time zone pre-filled - not blank fields.
3. Change the phone number field and click Save.
   **Expect:** "Saved" appears next to the button. Reload the page - the new phone number is still there.
4. Try changing the notification channel to "Text" only.
   **Expect:** the pill updates immediately and shows "Saved" - no separate save button for this section.
5. Click "Request a copy of my information."
   **Expect:** "We received your request and will respond within three business days." appears immediately below the button - no confirmation dialog first.
6. Click "Delete my account."
   **Expect:** the same confirmation text appears below that button too - clicking it does NOT actually delete anything or sign the member out (fulfillment is a manual admin queue item, per P6/A5's existing `mark_data_request_fulfilled`).
7. Click "Sign out."
   **Expect:** redirected to `/sign-in`, and navigating back to `/account` directly redirects to sign-in again rather than showing stale data.

## Regression (previous two sessions)
- [ ] L3 PR1 (self-update functions, #112): a member still cannot edit `status` or `cohort_id` on their own row even indirectly - there's no field on this screen for either, and the underlying column grant excludes them regardless.
- [ ] X3 (transactional messages, #110): changing the notification channel here doesn't break `notifySessionRescheduled`/`notifyCohortAssigned` - they read `preferred_contact_channel` fresh at send time, so a member's own change should route their next reminder through the new channel, not the old one.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
