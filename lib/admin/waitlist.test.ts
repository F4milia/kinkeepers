import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";
import { listWaitlistSummary } from "@/lib/admin/waitlist";

const admin = createAdminClient();

// applicant_waitlist_summary aggregates the ENTIRE applicants table by
// (relationship, care_recipient_stage) - it has no per-test scope, by
// design (the real feature is a whole-table question: "which groupings
// have enough people waiting to open a new cohort"). care_recipient_stage
// is a fixed 4-value enum and can't be uniquified, so relationship
// (free text) carries a per-run unique marker instead - otherwise this
// suite collides with any other concurrently-running test file that
// happens to use a common relationship value like "spouse" or "adult
// child" at the same stage (confirmed happening against
// lib/admin/assignment.test.ts's own fixture).
const runId = Date.now();
const groupARelationship = `wl-spouse-${runId}`;
const groupBRelationship = `wl-adult-child-${runId}`;

describe("listWaitlistSummary", () => {
  let adminUser: { id: string };
  let memberUser: { id: string };
  let partnerOrgId: string;
  const applicantIds: string[] = [];

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `waitlist-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: memberData, error: memberError } = await admin.auth.admin.createUser({
      email: `waitlist-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberData.user) throw memberError ?? new Error("createUser failed");
    memberUser = memberData.user;

    const { data: org, error: orgError } = await admin
      .from("partner_organizations")
      .insert({ name: "Waitlist Test Org", referral_link_slug: `waitlist-test-org-${Date.now()}` })
      .select("id")
      .single();
    if (orgError || !org) throw orgError ?? new Error("failed to create partner org");
    partnerOrgId = org.id;

    // Two applicants in the same relationship/stage group - one backdated
    // so this group's oldest wait is measurable and distinct from a
    // second, single-applicant group.
    const oldTimestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const { data: older, error: olderError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: partnerOrgId,
        referral_source: "partner_link",
        relationship: groupARelationship,
        care_recipient_stage: "early",
        status: "pending_review",
      })
      .select("id")
      .single();
    if (olderError || !older) throw olderError ?? new Error("failed to seed applicant");
    applicantIds.push(older.id);
    await admin.from("applicants").update({ pending_review_since: oldTimestamp }).eq("id", older.id);

    const { data: newer, error: newerError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: partnerOrgId,
        referral_source: "partner_link",
        relationship: groupARelationship,
        care_recipient_stage: "early",
        status: "pending_review",
      })
      .select("id")
      .single();
    if (newerError || !newer) throw newerError ?? new Error("failed to seed applicant");
    applicantIds.push(newer.id);

    const { data: other, error: otherError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: partnerOrgId,
        referral_source: "staff_form",
        relationship: groupBRelationship,
        care_recipient_stage: "middle",
        status: "pending_review",
      })
      .select("id")
      .single();
    if (otherError || !other) throw otherError ?? new Error("failed to seed applicant");
    applicantIds.push(other.id);

    // A declined applicant in the same group as the "older"/"newer" pair -
    // must NOT count toward the group's waiting_count.
    const { data: declined, error: declinedError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: partnerOrgId,
        referral_source: "partner_link",
        relationship: groupARelationship,
        care_recipient_stage: "early",
        status: "declined",
        decline_reason: "other",
      })
      .select("id")
      .single();
    if (declinedError || !declined) throw declinedError ?? new Error("failed to seed applicant");
    applicantIds.push(declined.id);
  });

  afterAll(async () => {
    await admin.from("applicants").delete().in("id", applicantIds);
    await admin.from("partner_organizations").delete().eq("id", partnerOrgId);
    await admin.auth.admin.deleteUser(memberUser.id);
    await admin.auth.admin.deleteUser(adminUser.id);
  });

  it("rejects a non-admin caller", async () => {
    const memberClient = await clientForUser(memberUser.id);
    await expect(listWaitlistSummary(memberClient)).rejects.toThrow(ForbiddenError);
  });

  it("groups by relationship and stage, counting only pending_review applicants, oldest wait first", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const groups = await listWaitlistSummary(adminClient);

    const groupA = groups.find((g) => g.relationship === groupARelationship && g.careRecipientStage === "early");
    expect(groupA?.waitingCount).toBe(2); // not 3 - the declined one is excluded
    expect(groupA?.daysWaiting).toBeGreaterThanOrEqual(10);

    const groupB = groups.find((g) => g.relationship === groupBRelationship && g.careRecipientStage === "middle");
    expect(groupB?.waitingCount).toBe(1);

    // Oldest wait first: group A's oldest applicant is 10 days old, older
    // than group B's fresh one.
    expect(groups.indexOf(groupA!)).toBeLessThan(groups.indexOf(groupB!));
  });
});
