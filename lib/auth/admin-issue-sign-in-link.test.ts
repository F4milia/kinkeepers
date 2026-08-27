import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueAdminSignInLink } from "@/lib/auth/admin-issue-sign-in-link";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";

const admin = createAdminClient();

async function createTestUser(opts: { email: string; phone?: string; role?: "admin" | "member" }) {
  const { data, error } = await admin.auth.admin.createUser({
    email: opts.email,
    email_confirm: true,
    phone: opts.phone,
    phone_confirm: Boolean(opts.phone),
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  if (opts.role) {
    await admin.from("profiles").update({ role: opts.role }).eq("id", data.user.id);
  }
  return data.user;
}

describe("issueAdminSignInLink", () => {
  let adminUser: { id: string; email?: string };
  let memberUser: { id: string; email?: string };
  const memberPhone = "+15551230001";

  beforeAll(async () => {
    adminUser = await createTestUser({
      email: `admin-link-test-${Date.now()}@example.com`,
      role: "admin",
    });
    memberUser = await createTestUser({
      email: `member-link-test-${Date.now()}@example.com`,
      phone: memberPhone,
      role: "member",
    });
  });

  afterAll(async () => {
    // adminUser is deliberately NOT deleted here. audit_log is genuinely
    // append-only (P7a's migration revokes UPDATE/DELETE from
    // service_role on it, on purpose - even the admin client can't
    // touch a row once written), and audit_log.actor_id has a foreign
    // key to profiles(id) with no ON DELETE behavior (defaults to
    // RESTRICT). The "issues a link" test below makes adminUser a real
    // audit_log actor, and there is no code path - not this test, not
    // any admin client - that can delete that profile/auth.users row
    // afterward. That's not a bug to work around; it's the actual,
    // permanent shape of the constraint: once a profile has acted as an
    // audit_log actor, it can never be deleted. (Confirmed directly
    // against GoTrue's logs: "violates foreign key constraint
    // audit_log_actor_id_fkey", SQLSTATE 23503, when this test
    // previously tried.) Real deletion-request fulfillment (P6/A5) will
    // need to design around this - e.g. anonymize/detach rather than
    // hard-delete an actor's profile - not assume a plain DELETE works.
    //
    // adminUser's email is Date.now()-suffixed, so repeated local runs
    // accumulate harmless, uniquely-named leftover admin test rows
    // rather than colliding - same tradeoff as not being able to clean
    // them up.
    const { error: deleteMemberError } = await admin.auth.admin.deleteUser(memberUser.id);
    if (deleteMemberError) throw deleteMemberError;
  });

  beforeEach(async () => {
    await admin.from("sign_in_events").delete().eq("identifier", memberPhone);
  });

  it("rejects a non-admin caller before doing anything else", async () => {
    // requireRole() (via the injected client) reads the real session, so
    // this exercises the actual guard rather than assuming it - sign in
    // as the member (default role) and confirm the action refuses them.
    const memberClient = await clientForUser(memberUser.id);
    await expect(
      issueAdminSignInLink(memberUser.email!, "test", memberClient),
    ).rejects.toThrow(ForbiddenError);
  });

  it("requires a non-empty reason", async () => {
    const adminClient = await clientForUser(adminUser.id);
    await expect(
      issueAdminSignInLink(memberUser.email!, "  ", adminClient),
    ).rejects.toThrow(/reason/i);
  });

  it("does not create a new user for an unrecognized email", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const unknownEmail = `nobody-${Date.now()}@example.com`;
    const result = await issueAdminSignInLink(
      unknownEmail,
      "phone verification attempted",
      adminClient,
    );
    expect(result).toEqual({ success: false, reason: "not_found" });

    const { data } = await admin.auth.admin.listUsers();
    expect(data.users.some((u) => u.email === unknownEmail)).toBe(false);
  });

  it("issues a link for an existing member and writes a matching audit row", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const reason = "confirmed DOB and address by phone";
    const result = await issueAdminSignInLink(memberUser.email!, reason, adminClient);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.actionLink).toContain("magiclink");

    const { data: auditRows } = await admin
      .from("audit_log")
      .select("*")
      .eq("subject_id", memberUser.id)
      .eq("action", "admin_sign_in_link_issued");

    expect(auditRows).toHaveLength(1);
    expect(auditRows![0]).toMatchObject({
      actor_id: adminUser.id,
      action: "admin_sign_in_link_issued",
      subject_type: "member",
      subject_id: memberUser.id,
      reason,
    });
  });

  it("named edge case: admin-issued link and the member's own SMS request are independent, and the link is single-use", async () => {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: memberUser.email!,
    });
    if (linkError || !linkData) throw linkError ?? new Error("generateLink failed");

    const anonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // The member independently requests their own SMS code - the same
    // Supabase Auth call lib/auth/actions.ts's requestSmsCode() makes
    // internally (called directly here rather than through that wrapper,
    // since its rate-limit logging depends on Next's request-scoped
    // headers()/cookies(), unavailable outside a real request; that
    // plumbing isn't what this assertion is about). Twilio isn't wired up
    // yet (P1 PR4's SMS half), so this is expected to fail at the send
    // step - the point here is that it does NOT touch or invalidate the
    // admin-issued link, not that the SMS actually delivers.
    const smsResult = await anonClient.auth.signInWithOtp({ phone: memberPhone });
    expect(smsResult.error).not.toBeNull();

    // First consumption of the admin-issued link succeeds...
    const first = await anonClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });
    expect(first.error).toBeNull();
    expect(first.data.user?.id).toBe(memberUser.id);

    // ...and a second attempt with the same token fails - single-use,
    // unaffected by the SMS request that happened in between.
    const second = await anonClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });
    expect(second.error).not.toBeNull();
  });
});
