import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSelfReferral, saveIntakeProgress, completeIntake } from "@/lib/referral/actions";
import { resolveApplicantByResumeToken } from "@/lib/referral/data";

// Real Resend sends don't belong in an automated suite that runs on
// every CI run - mocked here so the actual assertion (fires once, on
// the specific save where email first appears, never again after) is
// testable without hitting the network or spending send quota. P1's
// Resend wiring itself was already verified end-to-end with a real send
// (documented in that session); this test is about the trigger logic,
// not about proving Resend delivery works.
vi.mock("@/lib/referral/send-resume-email", () => ({
  sendResumeEmail: vi.fn(),
}));

import { sendResumeEmail } from "@/lib/referral/send-resume-email";

const admin = createAdminClient();

describe("intake progress", () => {
  let partnerOrgId: string;
  const partnerSlug = `pgtap-intake-progress-test-${Date.now()}`;

  beforeAll(async () => {
    const { data, error } = await admin
      .from("partner_organizations")
      .insert({ name: "Intake Progress Test Org", referral_link_slug: partnerSlug })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("failed to create partner org");
    partnerOrgId = data.id;
  });

  afterAll(async () => {
    // Not deleting partnerOrgId or any applicants it references - see
    // lib/referral/actions.test.ts's afterAll for why (permanently
    // undeletable once an applicant has a status-event history, which
    // is always, immediately).
    void partnerOrgId;
  });

  it("saves a partial update without requiring every field", async () => {
    const created = await createSelfReferral(partnerSlug);
    if (!created.success) throw new Error("expected success");

    const result = await saveIntakeProgress(created.resumeToken, { firstName: "Jordan" });
    expect(result).toEqual({ success: true });

    const resolved = await resolveApplicantByResumeToken(created.resumeToken);
    expect(resolved.found).toBe(true);
    if (!resolved.found) throw new Error("expected found");
    expect(resolved.fields.firstName).toBe("Jordan");
    expect(resolved.fields.lastName).toBeNull();
  });

  it("returns not_found for an unknown resume token", async () => {
    const result = await saveIntakeProgress("00000000-0000-0000-0000-000000000000", {
      firstName: "Nobody",
    });
    expect(result).toEqual({ success: false, reason: "not_found" });
  });

  it("never exposes partner_reference_id or partner_organization_id via resolveApplicantByResumeToken", async () => {
    const created = await createSelfReferral(partnerSlug, "should-never-leak");
    if (!created.success) throw new Error("expected success");

    const resolved = await resolveApplicantByResumeToken(created.resumeToken);
    expect(resolved.found).toBe(true);
    if (!resolved.found) throw new Error("expected found");
    expect(Object.keys(resolved.fields)).not.toContain("partnerReferenceId");
    expect(Object.keys(resolved.fields)).not.toContain("partnerOrganizationId");
    expect(JSON.stringify(resolved.fields)).not.toContain("should-never-leak");
  });

  it("fires the resume email exactly once - when email first appears, never again after", async () => {
    vi.mocked(sendResumeEmail).mockClear();
    const created = await createSelfReferral(partnerSlug);
    if (!created.success) throw new Error("expected success");

    // Save 1: no email yet - no send.
    await saveIntakeProgress(created.resumeToken, { firstName: "Casey" });
    expect(sendResumeEmail).not.toHaveBeenCalled();

    // Save 2: email appears for the first time - exactly one send.
    await saveIntakeProgress(created.resumeToken, { email: "casey@example.com" });
    expect(sendResumeEmail).toHaveBeenCalledTimes(1);
    expect(sendResumeEmail).toHaveBeenCalledWith(
      "casey@example.com",
      created.resumeToken,
      expect.any(String),
    );

    // Save 3: further edits, email already present - no additional send.
    await saveIntakeProgress(created.resumeToken, { lastName: "Nguyen" });
    expect(sendResumeEmail).toHaveBeenCalledTimes(1);
  });

  it("completeIntake transitions status to intake_complete, which immediately auto-advances to pending_review", async () => {
    // A2 (Wave 3) added a database trigger that advances intake_complete
    // straight to pending_review: nothing else ever put an applicant in
    // the review queue, so "finished intake" and "waiting for review"
    // are made the same moment. intake_complete still exists as a real,
    // separately-logged transition in applicant_status_events (verified
    // in supabase/tests/database/applicant_assignment.sql) - it just
    // never persists as the applicant's resting status.
    const created = await createSelfReferral(partnerSlug);
    if (!created.success) throw new Error("expected success");

    const result = await completeIntake(created.resumeToken);
    expect(result).toEqual({ success: true });

    const resolved = await resolveApplicantByResumeToken(created.resumeToken);
    expect(resolved.found).toBe(true);
    if (!resolved.found) throw new Error("expected found");
    expect(resolved.fields.status).toBe("pending_review");
  });

  it("completeIntake returns not_found for an unknown resume token", async () => {
    const result = await completeIntake("00000000-0000-0000-0000-000000000000");
    expect(result).toEqual({ success: false, reason: "not_found" });
  });
});
