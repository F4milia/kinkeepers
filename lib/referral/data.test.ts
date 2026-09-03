import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartnerBySlug, resolveApplicantByResumeToken } from "@/lib/referral/data";

const admin = createAdminClient();

describe("resolvePartnerBySlug", () => {
  let orgId: string;
  const slug = `referral-data-test-org-${Date.now()}`;

  beforeAll(async () => {
    const { data, error } = await admin
      .from("partner_organizations")
      .insert({ name: "Referral Data Test Org", referral_link_slug: slug })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("failed to create org");
    orgId = data.id;
  });

  afterAll(async () => {
    await admin.from("partner_organizations").delete().eq("id", orgId);
  });

  it("resolves a real slug for an unauthenticated (anon) caller - this is a public, pre-signup lookup", async () => {
    const anonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const result = await resolvePartnerBySlug(slug, anonClient);
    expect(result).toEqual({ found: true, id: orgId, name: "Referral Data Test Org" });
  });

  it("returns found: false for a slug that doesn't exist", async () => {
    const anonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const result = await resolvePartnerBySlug("no-such-slug-at-all", anonClient);
    expect(result).toEqual({ found: false });
  });
});

describe("resolveApplicantByResumeToken", () => {
  let orgId: string;
  let applicantId: string;
  let resumeToken: string;

  beforeAll(async () => {
    const { data: org, error: orgError } = await admin
      .from("partner_organizations")
      .insert({ name: "Resume Token Test Org", referral_link_slug: `resume-token-test-org-${Date.now()}` })
      .select("id")
      .single();
    if (orgError || !org) throw orgError ?? new Error("failed to create org");
    orgId = org.id;

    const { data: applicant, error: applicantError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: orgId,
        referral_source: "partner_link",
        partner_reference_id: "should-never-be-returned",
        first_name: "Resume",
        last_name: "Tokenholder",
        email: "resume-token-test@example.com",
        phone: "+15550001234",
        time_zone: "America/New_York",
        relationship: "spouse",
        care_recipient_stage: "early",
        preferred_contact_channel: "email",
        status: "referred",
      })
      .select("id, resume_token")
      .single();
    if (applicantError || !applicant) throw applicantError ?? new Error("failed to create applicant");
    applicantId = applicant.id;
    resumeToken = applicant.resume_token;
  });

  afterAll(async () => {
    await admin.from("applicants").delete().eq("id", applicantId);
    await admin.from("partner_organizations").delete().eq("id", orgId);
  });

  it("resolves a real resume token to only the safe, applicant-facing fields", async () => {
    const result = await resolveApplicantByResumeToken(resumeToken);
    expect(result).toEqual({
      found: true,
      fields: {
        firstName: "Resume",
        lastName: "Tokenholder",
        email: "resume-token-test@example.com",
        phone: "+15550001234",
        timeZone: "America/New_York",
        relationship: "spouse",
        careRecipientStage: "early",
        availabilityWindows: null,
        preferredContactChannel: "email",
        status: "referred",
      },
    });
  });

  it("never returns partner_reference_id or partner_organization_id, even though the underlying row has them", async () => {
    const result = await resolveApplicantByResumeToken(resumeToken);
    if (!result.found) throw new Error("expected the fixture's own resume token to resolve");
    const returnedKeys = Object.keys(result.fields);
    expect(returnedKeys).not.toContain("partnerReferenceId");
    expect(returnedKeys).not.toContain("partnerOrganizationId");
    expect(JSON.stringify(result.fields)).not.toContain("should-never-be-returned");
  });

  it("returns found: false for a resume token that doesn't exist", async () => {
    const result = await resolveApplicantByResumeToken("00000000-0000-0000-0000-000000000000");
    expect(result).toEqual({ found: false });
  });
});
