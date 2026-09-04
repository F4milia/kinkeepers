import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSelfReferral, createStaffReferral, createStaffReferralAction } from "@/lib/referral/actions";
import { resolvePartnerBySlug } from "@/lib/referral/data";
import { ForbiddenError, UnauthenticatedError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";

// getRequestOrigin() (used by createStaffReferralAction) calls
// next/headers's headers(), which throws outside a real Next.js request
// context - same pattern as lib/auth/actions.test.ts and
// admin-issue-sign-in-link.test.ts.
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => (name === "host" ? "localhost:3000" : null) }),
}));

const admin = createAdminClient();

function anonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

describe("referral capture", () => {
  let partnerOrgId: string;
  const partnerSlug = `pgtap-referral-test-${Date.now()}`;
  let staffUserId: string;
  let memberUserId: string;

  beforeAll(async () => {
    const { data: partner, error: partnerError } = await admin
      .from("partner_organizations")
      .insert({ name: "Referral Test Org", referral_link_slug: partnerSlug })
      .select("id")
      .single();
    if (partnerError || !partner) throw partnerError ?? new Error("failed to create partner org");
    partnerOrgId = partner.id;

    const { data: staffUser, error: staffError } = await admin.auth.admin.createUser({
      email: `referral-staff-test-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (staffError || !staffUser.user) throw staffError ?? new Error("failed to create staff user");
    staffUserId = staffUser.user.id;
    await admin
      .from("profiles")
      .update({ role: "partner_staff", partner_organization_id: partnerOrgId })
      .eq("id", staffUserId);

    const { data: memberUser, error: memberError } = await admin.auth.admin.createUser({
      email: `referral-member-test-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberUser.user) throw memberError ?? new Error("failed to create member user");
    memberUserId = memberUser.user.id;
  });

  afterAll(async () => {
    // Deliberately NOT deleting any applicant rows this suite created,
    // and NOT deleting partnerOrgId either. Found the hard way (first
    // version of this test tried both): applicant_status_events.applicant_id
    // -> applicants(id) has no ON DELETE behavior (defaults to RESTRICT),
    // and the log_applicant_status_event trigger fires on every insert -
    // so EVERY applicant row has a status-event history from the moment
    // it's created, and can never be hard-deleted. That in turn means
    // any partner_organizations row an applicant references can't be
    // deleted either. Same class of permanent-once-referenced constraint
    // as audit_log.actor_id (see CLAUDE.md's Learned constraints,
    // 2026-08-27 entry) - except this one applies to applicants
    // themselves, not just actor profiles, which matters directly for
    // P6/A5's future deletion-request fulfillment: an applicant/member
    // can never be hard-deleted once they have any status history
    // (which is always, immediately, by design), so that flow will need
    // to anonymize/detach rather than assume a plain DELETE works, same
    // as the existing note already says for actor profiles.
    //
    // staffUserId/memberUserId ARE deleted below - neither is ever an
    // actor_id in this test (nothing here sets the
    // app.current_actor_id GUC the trigger reads), so nothing
    // references their profile row and deletion succeeds normally.
    await admin.auth.admin.deleteUser(staffUserId);
    await admin.auth.admin.deleteUser(memberUserId);
  });

  describe("resolvePartnerBySlug", () => {
    it("resolves a real partner by slug", async () => {
      const result = await resolvePartnerBySlug(partnerSlug, anonClient());
      expect(result).toEqual({ found: true, id: partnerOrgId, name: "Referral Test Org" });
    });

    it("returns not-found for an unknown slug", async () => {
      const result = await resolvePartnerBySlug("no-such-partner-slug", anonClient());
      expect(result).toEqual({ found: false });
    });
  });

  describe("createSelfReferral", () => {
    it("creates an applicant scoped to the resolved partner", async () => {
      const result = await createSelfReferral(partnerSlug, "ext-ref-1");
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("expected success");

      const { data } = await admin
        .from("applicants")
        .select("partner_organization_id, referral_source, partner_reference_id, status")
        .eq("id", result.applicantId)
        .single();
      expect(data).toMatchObject({
        partner_organization_id: partnerOrgId,
        referral_source: "partner_link",
        partner_reference_id: "ext-ref-1",
        status: "referred",
      });
    });

    it("works identically without a partner_reference_id", async () => {
      const result = await createSelfReferral(partnerSlug);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("expected success");

      const { data } = await admin
        .from("applicants")
        .select("partner_reference_id")
        .eq("id", result.applicantId)
        .single();
      expect(data?.partner_reference_id).toBeNull();
    });

    it("refuses an unresolvable partner slug", async () => {
      const result = await createSelfReferral("no-such-partner-slug");
      expect(result).toEqual({ success: false, reason: "partner_not_found" });
    });

    it("refuses a partner_reference_id over 64 characters", async () => {
      const result = await createSelfReferral(partnerSlug, "x".repeat(65));
      expect(result).toEqual({ success: false, reason: "invalid_partner_reference_id" });
    });
  });

  describe("createStaffReferral", () => {
    it("creates an applicant scoped to the caller's own partner organization", async () => {
      const staffClient = await clientForUser(staffUserId);
      const result = await createStaffReferral("ext-ref-2", staffClient);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("expected success");

      const { data } = await admin
        .from("applicants")
        .select("partner_organization_id, referral_source")
        .eq("id", result.applicantId)
        .single();
      expect(data).toMatchObject({
        partner_organization_id: partnerOrgId,
        referral_source: "staff_form",
      });
    });

    it("rejects a caller who isn't partner_staff", async () => {
      const memberClient = await clientForUser(memberUserId);
      await expect(createStaffReferral(undefined, memberClient)).rejects.toThrow(ForbiddenError);
    });

    it("rejects an unauthenticated caller", async () => {
      await expect(createStaffReferral(undefined, anonClient())).rejects.toThrow(UnauthenticatedError);
    });
  });

  it("named edge case: the same caregiver referred via both paths creates two separate, correctly-sourced records", async () => {
    const staffClient = await clientForUser(staffUserId);
    // Unique per run: applicant rows are never deleted (see afterAll's
    // comment), so a shared literal here would accumulate matches
    // across runs and break the toHaveLength(2) assertion below.
    const dupRef = `dup-test-${Date.now()}`;

    const selfResult = await createSelfReferral(partnerSlug, dupRef);
    const staffResult = await createStaffReferral(dupRef, staffClient);

    expect(selfResult.success).toBe(true);
    expect(staffResult.success).toBe(true);
    if (!selfResult.success || !staffResult.success) throw new Error("expected both to succeed");

    expect(selfResult.applicantId).not.toBe(staffResult.applicantId);

    const { data } = await admin
      .from("applicants")
      .select("id, referral_source")
      .eq("partner_reference_id", dupRef)
      .order("referral_source");

    expect(data).toHaveLength(2);
    expect(data!.map((r) => r.referral_source).sort()).toEqual(["partner_link", "staff_form"]);
  });

  // The Server Action wrapper behind app/admin/refer - found missing
  // entirely (createStaffReferral existed and was tested above, but no
  // screen ever called it) during a 2026-09-04 acceptance-criteria audit.
  describe("createStaffReferralAction", () => {
    function formDataWith(partnerReferenceId?: string) {
      const fd = new FormData();
      if (partnerReferenceId !== undefined) fd.set("partnerReferenceId", partnerReferenceId);
      return fd;
    }

    it("returns a resume URL built from the real request origin on success", async () => {
      const staffClient = await clientForUser(staffUserId);
      const result = await createStaffReferralAction(
        { status: "idle", fieldErrors: {} },
        formDataWith("ext-ref-action-1"),
        staffClient,
      );
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("expected success");
      expect(result.resumeUrl).toMatch(/^https:\/\/localhost:3000\/intake\/resume\?token=/);

      const token = new URL(result.resumeUrl!).searchParams.get("token");
      const { data } = await admin
        .from("applicants")
        .select("resume_token, referral_source, partner_reference_id")
        .eq("resume_token", token)
        .single();
      expect(data).toMatchObject({ referral_source: "staff_form", partner_reference_id: "ext-ref-action-1" });
    });

    it("works identically with no partner reference id", async () => {
      const staffClient = await clientForUser(staffUserId);
      const result = await createStaffReferralAction(
        { status: "idle", fieldErrors: {} },
        formDataWith(),
        staffClient,
      );
      expect(result.status).toBe("success");
    });

    it("returns a field error for a partner reference id over 64 characters, without touching the database", async () => {
      const staffClient = await clientForUser(staffUserId);
      const result = await createStaffReferralAction(
        { status: "idle", fieldErrors: {} },
        formDataWith("x".repeat(65)),
        staffClient,
      );
      expect(result).toEqual({
        status: "error",
        fieldErrors: { partnerReferenceId: expect.stringContaining("64 characters") },
      });
    });

    it("propagates the role rejection for a non-partner_staff caller", async () => {
      const memberClient = await clientForUser(memberUserId);
      await expect(
        createStaffReferralAction({ status: "idle", fieldErrors: {} }, formDataWith(), memberClient),
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
