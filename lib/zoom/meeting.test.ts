import { describe, expect, it, vi } from "vitest";
import { createRecurringMeeting } from "@/lib/zoom/meeting";

// Injected mock fetch, not a global stub - see lib/zoom/client.test.ts for
// why (cross-file global pollution, reproduced and fixed in PR1).
let credentialCounter = 0;
function freshCredentials() {
  credentialCounter += 1;
  return {
    accountId: `acct-${credentialCounter}`,
    clientId: `client-${credentialCounter}`,
    clientSecret: `secret-${credentialCounter}`,
  };
}

function mockZoomFetch(createMeetingResponse: Record<string, unknown>) {
  return vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "tok-x", expires_in: 3600 }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => createMeetingResponse,
    });
}

const baseParams = {
  topic: "Spouses, early stage - Tuesday evenings",
  startTime: "2026-09-01T18:30:00",
  timezone: "America/New_York",
  durationMinutes: 90,
  sessionCount: 6,
  repeatIntervalWeeks: 1,
};

describe("createRecurringMeeting", () => {
  it("sends all four verifiable enforced settings and an explicit password", async () => {
    const credentials = freshCredentials();
    const fetchMock = mockZoomFetch({
      id: 123456789,
      join_url: "https://zoom.us/j/123456789",
      password: "aB3xY9",
    });

    await createRecurringMeeting(baseParams, credentials, fetchMock as unknown as typeof fetch);

    const [, init] = fetchMock.mock.calls[1];
    const body = JSON.parse(init.body as string);

    expect(body.settings).toMatchObject({
      auto_recording: "none",
      waiting_room: true,
      join_before_host: false,
    });
    expect(typeof body.password).toBe("string");
    expect(body.password.length).toBeGreaterThan(0);
  });

  it("sends a recurring meeting type with recurrence matching the program's session count and cadence", async () => {
    const credentials = freshCredentials();
    const fetchMock = mockZoomFetch({
      id: 1,
      join_url: "https://zoom.us/j/1",
      password: "x",
    });

    await createRecurringMeeting(
      { ...baseParams, sessionCount: 9, repeatIntervalWeeks: 2 },
      credentials,
      fetchMock as unknown as typeof fetch,
    );

    const [, init] = fetchMock.mock.calls[1];
    const body = JSON.parse(init.body as string);

    expect(body.type).toBe(8);
    expect(body.recurrence).toMatchObject({ repeat_interval: 2, end_times: 9 });
  });

  it("maps the Zoom response into join URL, passcode, and dial-in details", async () => {
    const credentials = freshCredentials();
    const fetchMock = mockZoomFetch({
      id: 123456789,
      join_url: "https://zoom.us/j/123456789",
      password: "aB3xY9",
      h323_password: "445566",
      settings: {
        global_dial_in_numbers: [{ number: "+1 305 224 1968", type: "toll", country: "US" }],
      },
      occurrences: [{ occurrence_id: "occ-1", start_time: "2026-09-01T18:30:00Z" }],
    });

    const meeting = await createRecurringMeeting(
      baseParams,
      credentials,
      fetchMock as unknown as typeof fetch,
    );

    expect(meeting).toEqual({
      meetingId: "123456789",
      joinUrl: "https://zoom.us/j/123456789",
      passcode: "aB3xY9",
      dialInNumber: "+1 305 224 1968",
      dialInPin: "445566",
      occurrenceIds: ["occ-1"],
    });
  });

  it("returns occurrence ids sorted by start_time, matching session_number order", async () => {
    const credentials = freshCredentials();
    const fetchMock = mockZoomFetch({
      id: 1,
      join_url: "https://zoom.us/j/1",
      password: "x",
      // Deliberately out of order in the response, to prove sorting isn't
      // just "pass Zoom's array through as-is".
      occurrences: [
        { occurrence_id: "occ-3", start_time: "2026-09-15T18:30:00Z" },
        { occurrence_id: "occ-1", start_time: "2026-09-01T18:30:00Z" },
        { occurrence_id: "occ-2", start_time: "2026-09-08T18:30:00Z" },
      ],
    });

    const meeting = await createRecurringMeeting(baseParams, credentials, fetchMock as unknown as typeof fetch);

    expect(meeting.occurrenceIds).toEqual(["occ-1", "occ-2", "occ-3"]);
  });

  it("returns an empty occurrenceIds array when Zoom returns no occurrences", async () => {
    const credentials = freshCredentials();
    const fetchMock = mockZoomFetch({ id: 1, join_url: "https://zoom.us/j/1", password: "x" });

    const meeting = await createRecurringMeeting(baseParams, credentials, fetchMock as unknown as typeof fetch);

    expect(meeting.occurrenceIds).toEqual([]);
  });

  it("handles a response with no dial-in numbers gracefully (null, not a crash)", async () => {
    const credentials = freshCredentials();
    const fetchMock = mockZoomFetch({
      id: 1,
      join_url: "https://zoom.us/j/1",
      password: "x",
    });

    const meeting = await createRecurringMeeting(
      baseParams,
      credentials,
      fetchMock as unknown as typeof fetch,
    );

    expect(meeting.dialInNumber).toBeNull();
    expect(meeting.dialInPin).toBe("x"); // falls back to the passcode
  });

  it("uses partner-supplied credentials when given, not the default env vars - the named edge case", async () => {
    const partnerCredentials = {
      accountId: "partner-acct",
      clientId: "partner-client",
      clientSecret: "partner-secret",
    };
    const fetchMock = mockZoomFetch({ id: 1, join_url: "https://zoom.us/j/1", password: "x" });

    await createRecurringMeeting(baseParams, partnerCredentials, fetchMock as unknown as typeof fetch);

    const [tokenUrl] = fetchMock.mock.calls[0];
    expect(tokenUrl).toContain(`account_id=${partnerCredentials.accountId}`);
  });
});
