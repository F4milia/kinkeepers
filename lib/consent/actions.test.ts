import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientForUser } from "@/test/helpers/local-auth";
import { recordConsent } from "@/lib/consent/actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// hashRequestIp() calls next/headers, which throws outside a real Next.js
// request context (same reasoning lib/auth/log-sign-in-event.test.ts
// already documents for this exact helper) - mocked to a fixed value so
// this suite can assert ip_hash actually lands on the row without needing
// a real request.
vi.mock("@/lib/auth/ip-hash", () => ({
  hashRequestIp: vi.fn().mockResolvedValue("fake-ip-hash-for-testing"),
}));

const admin = createAdminClient();

describe("recordConsent", () => {
  let memberUserId: string;
  let currentVersion: number;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `consent-actions-test-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("createUser failed");
    memberUserId = data.user.id;

    const { data: doc, error: docError } = await admin
      .from("consent_documents")
      .select("version")
      .eq("document_type", "privacy_policy")
      .order("version", { ascending: false })
      .limit(1)
      .single();
    if (docError || !doc) throw docError ?? new Error("no privacy_policy document seeded");
    currentVersion = doc.version;
  });

  afterAll(async () => {
    await admin.from("member_consents").delete().eq("member_id", memberUserId);
    await admin.auth.admin.deleteUser(memberUserId);
  });

  it("returns unauthenticated for a signed-out caller and writes nothing", async () => {
    const anonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const result = await recordConsent("privacy_policy", currentVersion, anonClient);
    expect(result).toEqual({ success: false, reason: "unauthenticated" });
  });

  it("records the signed-in caller's own member_id - never a client-supplied one, since there's no such parameter to spoof", async () => {
    const client = await clientForUser(memberUserId);
    const result = await recordConsent("privacy_policy", currentVersion, client);
    expect(result).toEqual({ success: true });

    const { data, error } = await admin
      .from("member_consents")
      .select("member_id, document_type, document_version, ip_hash")
      .eq("member_id", memberUserId)
      .eq("document_type", "privacy_policy")
      .single();
    if (error) throw error;
    expect(data).toEqual({
      member_id: memberUserId,
      document_type: "privacy_policy",
      document_version: currentVersion,
      ip_hash: "fake-ip-hash-for-testing",
    });
  });
});
