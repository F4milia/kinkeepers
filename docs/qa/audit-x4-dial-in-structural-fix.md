# QA — audit-x4-dial-in-structural-fix X4: Dial-in identity

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none from `docs/qa/FIXTURES.md` - the phone-matching logic itself is already thoroughly covered by `lib/zoom/phone-matching.test.ts`; this session's own fix is a UI-structure change, verified inline below with a fresh session/cohort rather than an existing fixture.

## Primary check (from the run doc's Named edge-case register)
Dial-in details must appear alongside every join link in the member UI - by construction, not by each screen separately remembering to render it.

1. As a real signed-in member with an upcoming video session that has real dial-in data, open Home.
   **Expect:** the "Join by video" button and the dial-in number + PIN both appear together, immediately below the meeting card.
2. Open that same session's detail page directly (`/session/[id]`).
   **Expect:** the same pairing appears again - join button and dial-in details together.
3. With the app offline (see `docs/qa/audit-l5-phone-number-and-3g-coverage.md`'s offline-cache steps) and a next-session cache present, trigger the offline-cache error view.
   **Expect:** the cached session card also shows the dial-in number and PIN, matching the other two screens.
4. As a real facilitator, open a session log for a session with at least one Zoom phone-in participant recorded in a real (or manually inserted) `session_attendance` correction path.
   **Expect:** an unrecognized number surfaces as "Unidentified caller — [last 4 digits]" with a dropdown to manually attribute it to a real roster member - this step needs a real Zoom meeting to fully exercise the matching step itself; the manual-attribution UI can be checked directly against any unmatched entry.

## Regression (previous two sessions)
- [ ] L5 (API integration and error states): the offline-cache error view still renders correctly end to end (session card, phone number, dial-in details, "Go to Home" link) - this session's own fix touched the same file (`(caregiver)/error.tsx`).
- [ ] A5 (oversight and queues): the facilitator session-log screen's attendance submission still works correctly for a normal (non-phone-joiner) session - unrelated to this session's own change, but the same file (`session-log.tsx`) already renders the unidentified-caller UI this session's audit reviewed.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
