-- A1 PR3: admin CRUD for partner_organizations. Composed into two
-- security-definer functions (rather than plain app-level insert/update +
-- a separate recordAuditEvent() call) so the mutation and its audit_log
-- row succeed or fail together in one transaction - see the audit_log
-- migration's comment on record_audit_event() for why a separate network
-- round-trip can't give that guarantee. CLAUDE.md invariant #9: "If the
-- audit write fails, the mutation fails."
--
-- These functions trust their actor_id argument - they do not
-- independently check the caller's role. The app-level Server Action
-- calls requireRole(["admin"]) first and only then invokes these via the
-- service-role client, same division of responsibility as
-- issueAdminSignInLink (lib/auth/admin-issue-sign-in-link.ts). EXECUTE is
-- granted to service_role only, so there is no path to call these
-- directly as anon/authenticated and bypass that check.

alter type audit_action add value 'partner_organization_created';
alter type audit_action add value 'partner_organization_updated';
