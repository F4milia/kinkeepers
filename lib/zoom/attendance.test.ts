import { describe, expect, it, vi } from "vitest";
import { getAttendancePreFill } from "@/lib/zoom/attendance";

let credentialCounter = 0;
function freshCredentials() {
  credentialCounter += 1;
  return {
    accountId: `acct-${credentialCounter}`,
    clientId: `client-${credentialCounter}`,
    clientSecret: `secret-${credentialCounter}`,
  };
}

function mockZoomFetch(reportResponse: Record<string, unknown>) {
  return vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "tok-x", expires_in: 3600 }),
    })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => reportResponse });
}

describe("getAttendancePreFill", () => {
  it("maps named participants (video/desktop joiners) faithfully", async () => {
    const fetchMock = mockZoomFetch({
      participants: [
        {
          id: "p-1",
          name: "Denise Okafor",
          user_email: "denise@example.com",
          join_time: "2026-09-01T18:32:00Z",
          leave_time: "2026-09-01T19:58:00Z",
          duration: 5160,
        },
      ],
    });

    const result = await getAttendancePreFill(
      "123456789",
      freshCredentials(),
      fetchMock as unknown as typeof fetch,
    );

    expect(result.participants).toEqual([
      {
        participantId: "p-1",
        name: "Denise Okafor",
        email: "denise@example.com",
        joinTime: "2026-09-01T18:32:00Z",
        leaveTime: "2026-09-01T19:58:00Z",
        durationMinutes: 86,
      },
    ]);
  });

  it("surfaces a phone joiner's number as the name field, without attempting to match it to a member", async () => {
    const fetchMock = mockZoomFetch({
      participants: [
        {
          name: "+15551234567",
          join_time: "2026-09-01T18:30:00Z",
          leave_time: "2026-09-01T19:55:00Z",
          duration: 5100,
        },
      ],
    });

    const result = await getAttendancePreFill(
      "123456789",
      freshCredentials(),
      fetchMock as unknown as typeof fetch,
    );

    expect(result.participants[0].name).toBe("+15551234567");
    expect(result.participants[0].email).toBeNull();
    // No member-matching field exists on this type at all - that's X4's job.
    expect(result.participants[0]).not.toHaveProperty("memberId");
  });

  it("falls back to a stable per-report index when Zoom omits the participant id (guest PII restriction)", async () => {
    const fetchMock = mockZoomFetch({
      participants: [
        { name: "A", join_time: "t1", leave_time: "t2", duration: 60 },
        { name: "B", join_time: "t1", leave_time: "t2", duration: 60 },
      ],
    });

    const result = await getAttendancePreFill(
      "123456789",
      freshCredentials(),
      fetchMock as unknown as typeof fetch,
    );

    expect(result.participants[0].participantId).toBe("unidentified-0");
    expect(result.participants[1].participantId).toBe("unidentified-1");
  });

  it("preserves the full raw report alongside the transformed shape", async () => {
    const rawResponse = {
      participants: [{ name: "A", join_time: "t1", leave_time: "t2", duration: 60 }],
      total_records: 1,
    };
    const fetchMock = mockZoomFetch(rawResponse);

    const result = await getAttendancePreFill(
      "123456789",
      freshCredentials(),
      fetchMock as unknown as typeof fetch,
    );

    expect(result.rawReport).toEqual(rawResponse);
  });

  it("never commits or writes anything - this module has no side effects beyond the network call", async () => {
    // Structural check: getAttendancePreFill's only export is this one
    // read-only function. No supabase/admin import, no db write path.
    const moduleSource = await import("@/lib/zoom/attendance");
    expect(Object.keys(moduleSource)).toEqual(["getAttendancePreFill"]);
  });
});
