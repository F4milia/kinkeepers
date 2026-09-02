import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  updateAccountInfo,
  updateNotificationPreferences,
  requestDataExport,
  requestAccountDeletion,
  signOut,
} from "@/lib/account/actions";

const getUser = vi.fn();
const rpc = vi.fn();
const eq = vi.fn(async () => ({ error: null }));
const update = vi.fn((_payload: Record<string, unknown>) => ({ eq }));
const insert = vi.fn(async (_payload: Record<string, unknown>) => ({ error: null }));
const from = vi.fn(() => ({ update, insert }));
const signOutMock = vi.fn(async () => ({ error: null }));
const redirectMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser, signOut: signOutMock }, rpc, from }),
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirectMock(path) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const SIGNED_IN_USER = { data: { user: { id: "user-1" } } };
const FIELDS = { firstName: "Ann", lastName: "Alpha", email: "ann@example.com", phone: "+15550170001", timeZone: "America/New_York" };

describe("updateAccountInfo", () => {
  beforeEach(() => {
    getUser.mockReset();
    rpc.mockReset();
    from.mockClear();
    update.mockClear();
    eq.mockClear();
  });

  it("returns unauthenticated for a signed-out caller and writes nothing", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await updateAccountInfo(FIELDS);

    expect(result).toEqual({ success: false, reason: "unauthenticated" });
    expect(from).not.toHaveBeenCalled();
  });

  it("resolves the applicant id server-side via the claim RPC, never from a client-passed value", async () => {
    getUser.mockResolvedValueOnce(SIGNED_IN_USER);
    rpc.mockResolvedValueOnce({ data: "applicant-1", error: null });

    const result = await updateAccountInfo(FIELDS);

    expect(rpc).toHaveBeenCalledWith("claim_applicant_for_current_user");
    expect(from).toHaveBeenCalledWith("applicants");
    expect(update).toHaveBeenCalledWith({
      first_name: "Ann",
      last_name: "Alpha",
      email: "ann@example.com",
      phone: "+15550170001",
      time_zone: "America/New_York",
    });
    expect(eq).toHaveBeenCalledWith("id", "applicant-1");
    expect(result).toEqual({ success: true });
  });

  it("never sends status or cohort_id in the update payload - only the fields this screen owns", async () => {
    getUser.mockResolvedValueOnce(SIGNED_IN_USER);
    rpc.mockResolvedValueOnce({ data: "applicant-1", error: null });

    await updateAccountInfo(FIELDS);

    const payload = update.mock.calls[0][0];
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("cohort_id");
  });
});

describe("updateNotificationPreferences", () => {
  beforeEach(() => {
    getUser.mockReset();
    rpc.mockReset();
    from.mockClear();
    update.mockClear();
  });

  it("persists the chosen channel against the caller's own applicant row", async () => {
    getUser.mockResolvedValueOnce(SIGNED_IN_USER);
    rpc.mockResolvedValueOnce({ data: "applicant-1", error: null });

    const result = await updateNotificationPreferences("sms");

    expect(update).toHaveBeenCalledWith({ preferred_contact_channel: "sms" });
    expect(result).toEqual({ success: true });
  });
});

describe("requestDataExport / requestAccountDeletion", () => {
  beforeEach(() => {
    getUser.mockReset();
    rpc.mockClear();
    from.mockClear();
    insert.mockClear();
  });

  it("requestDataExport inserts an 'export' member_data_requests row keyed on the signed-in profile, without the claim RPC", async () => {
    getUser.mockResolvedValueOnce(SIGNED_IN_USER);

    const result = await requestDataExport();

    expect(rpc).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("member_data_requests");
    expect(insert).toHaveBeenCalledWith({ member_id: "user-1", request_type: "export" });
    expect(result).toEqual({ success: true });
  });

  it("requestAccountDeletion inserts a 'deletion' row", async () => {
    getUser.mockResolvedValueOnce(SIGNED_IN_USER);

    await requestAccountDeletion();

    expect(insert).toHaveBeenCalledWith({ member_id: "user-1", request_type: "deletion" });
  });

  it("returns unauthenticated for a signed-out caller and writes nothing", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await requestDataExport();

    expect(result).toEqual({ success: false, reason: "unauthenticated" });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("signs out and redirects to /sign-in", async () => {
    redirectMock.mockClear();
    signOutMock.mockClear();

    await signOut();

    expect(signOutMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/sign-in");
  });
});
