import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";
import { listDataRequests, markDataRequestFulfilledAction, listConsentGaps } from "@/lib/admin/data-requests";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const admin = createAdminClient();

describe("data requests admin queue", () => {
  let adminUser: { id: string };
  let memberUser: { id: string; email?: string };
  const requestIds: string[] = [];

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `data-requests-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: memberData, error: memberError } = await admin.auth.admin.createUser({
      email: `data-requests-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberData.user) throw memberError ?? new Error("createUser failed");
    memberUser = memberData.user;
  });

  afterAll(async () => {
    await admin.from("member_data_requests").delete().in("id", requestIds);
    await admin.auth.admin.deleteUser(memberUser.id);
    await admin.auth.admin.deleteUser(adminUser.id);
  });

  async function insertRequest(requestType: "deletion" | "export") {
    const { data, error } = await admin
      .from("member_data_requests")
      .insert({ member_id: memberUser.id, request_type: requestType })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("failed to create request");
    requestIds.push(data.id);
    return data.id;
  }

  it("rejects a non-admin caller for both list and fulfill", async () => {
    const requestId = await insertRequest("deletion");
    const memberClient = await clientForUser(memberUser.id);
    await expect(listDataRequests(memberClient)).rejects.toThrow(ForbiddenError);
    await expect(markDataRequestFulfilledAction(requestId, "note", memberClient)).rejects.toThrow(ForbiddenError);
  });

  it("lists a pending request with the member's email resolved", async () => {
    const requestId = await insertRequest("export");
    const adminClient = await clientForUser(adminUser.id);

    const requests = await listDataRequests(adminClient);
    const found = requests.find((r) => r.id === requestId);
    expect(found).toBeTruthy();
    expect(found?.status).toBe("pending");
    expect(found?.requestType).toBe("export");
    expect(found?.memberEmail).toBe(memberUser.email);
  });

  it("marks a request fulfilled with a note, visible in the next list call", async () => {
    const requestId = await insertRequest("deletion");
    const adminClient = await clientForUser(adminUser.id);

    const result = await markDataRequestFulfilledAction(requestId, "Anonymized per policy", adminClient);
    expect(result).toEqual({ success: true });

    const requests = await listDataRequests(adminClient);
    const found = requests.find((r) => r.id === requestId);
    expect(found?.status).toBe("fulfilled");
    expect(found?.fulfillmentNote).toBe("Anonymized per policy");
    expect(found?.fulfilledAt).toBeTruthy();
  });

  it("fails cleanly when fulfilling without a note", async () => {
    const requestId = await insertRequest("export");
    const adminClient = await clientForUser(adminUser.id);

    const result = await markDataRequestFulfilledAction(requestId, "", adminClient);
    expect(result.success).toBe(false);
  });

  it("rejects a non-admin caller for consent gaps too", async () => {
    const memberClient = await clientForUser(memberUser.id);
    await expect(listConsentGaps(memberClient)).rejects.toThrow(ForbiddenError);
  });

  it("lists a member with no consent history as having a gap for every current document, with their email resolved", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const gaps = await listConsentGaps(adminClient);

    const ours = gaps.filter((g) => g.memberId === memberUser.id);
    expect(ours.length).toBeGreaterThan(0);
    expect(ours.every((g) => g.memberEmail === memberUser.email)).toBe(true);
    expect(gaps.some((g) => g.memberId === adminUser.id)).toBe(false);
  });
});
