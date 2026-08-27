"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";

export type IssueAdminSignInLinkResult =
  | { success: true; actionLink: string }
  | { success: false; reason: "not_found" | "audit_failed" };

async function findUserByEmail(email: string) {
  // supabase-js's admin listUsers doesn't reliably filter server-side by
  // email (confirmed by hand against the hosted project while testing
  // P1 PR4 - a `?email=` query param was accepted but ignored, every
  // user came back regardless). Filter client-side instead. Fine at this
  // scale for a rarely-used recovery action; revisit if the user base
  // grows large enough for pagination to matter here.
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) return null;
  return data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
}

/**
 * The human recovery path from the P1 spec: a verified staff member
 * issues a one-time sign-in link for an existing member after confirming
 * their identity by phone. Restricted to the admin role.
 *
 * The phone identity check itself is a human process this code cannot
 * verify - `reason` is where the admin records that it happened (e.g.
 * "confirmed DOB and address by phone"), and it's required for exactly
 * that purpose, not just as a log note.
 *
 * Deliberately does NOT create a new user for an unrecognized email -
 * Supabase's generateLink() would do that by default for type
 * "magiclink" (no shouldCreateUser option exists for that type, unlike
 * signInWithOtp), which is wrong for a recovery flow: this issues access
 * to an existing, identity-verified member, not a way to provision new
 * accounts.
 *
 * `callerClient` is optional and exists for testability, threaded
 * straight through to requireRole() - see roles.ts for why.
 */
export async function issueAdminSignInLink(
  memberEmail: string,
  reason: string,
  callerClient?: SupabaseClient,
): Promise<IssueAdminSignInLinkResult> {
  const { userId: actorId } = await requireRole(["admin"], callerClient);

  if (!reason.trim()) {
    throw new Error("A reason is required to issue an admin sign-in link");
  }

  const normalizedEmail = memberEmail.trim().toLowerCase();
  const targetUser = await findUserByEmail(normalizedEmail);
  if (!targetUser) {
    return { success: false, reason: "not_found" };
  }

  const admin = createAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
  });

  if (linkError || !linkData) {
    return { success: false, reason: "not_found" };
  }

  // The audit write can't be made atomic with generateLink() - that's an
  // external GoTrue Admin API call, not a SQL statement, so it can't
  // share a Postgres transaction with record_audit_event() the way the
  // P7a migration's worked example (a mutation composed into one
  // function) can. Best available guarantee: if the audit write fails,
  // the link is never returned to (or usable by) the caller - it sits
  // generated but undisclosed, and just expires unused like any other
  // unconsumed magic link.
  try {
    await recordAuditEvent({
      actorId,
      action: "admin_sign_in_link_issued",
      subjectType: "member",
      subjectId: targetUser.id,
      reason,
    });
  } catch {
    return { success: false, reason: "audit_failed" };
  }

  return { success: true, actionLink: linkData.properties.action_link };
}
