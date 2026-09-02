import { describe, expect, it, vi } from "vitest";
import { getMyAccount } from "@/lib/account/data";

const getUser = vi.fn();
const rpc = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, rpc, from }),
}));

describe("getMyAccount", () => {
  it("returns null for a signed-out caller", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await getMyAccount();

    expect(result).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns null when the caller's identity doesn't resolve to a real enrollment", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    rpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await getMyAccount();

    expect(result).toBeNull();
  });

  it("claims then loads the signed-in member's own applicant row", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    rpc.mockResolvedValueOnce({ data: "applicant-1", error: null });
    maybeSingle.mockResolvedValueOnce({
      data: {
        first_name: "Ann",
        last_name: "Alpha",
        email: "ann@example.com",
        phone: "+15550170001",
        time_zone: "America/New_York",
        preferred_contact_channel: "both",
      },
      error: null,
    });

    const result = await getMyAccount();

    expect(rpc).toHaveBeenCalledWith("claim_applicant_for_current_user");
    expect(from).toHaveBeenCalledWith("applicants");
    expect(eq).toHaveBeenCalledWith("id", "applicant-1");
    expect(result).toEqual({
      firstName: "Ann",
      lastName: "Alpha",
      email: "ann@example.com",
      phone: "+15550170001",
      timeZone: "America/New_York",
      preferredContactChannel: "both",
    });
  });

  it("throws the real error rather than swallowing it when the claim RPC fails", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    rpc.mockResolvedValueOnce({ data: null, error: new Error("ambiguous_applicant_match") });

    await expect(getMyAccount()).rejects.toThrow("ambiguous_applicant_match");
  });
});
