import type { AppRole } from "@/lib/auth/roles";

export interface AdminNavItem {
  href: string;
  /** Label can differ by role for the same route - e.g. a facilitator's
   * own cohorts list reads "My cohorts", the same route reads "Cohorts"
   * for admin/partner_staff, who see more than just their own. */
  label: (role: AppRole) => string;
  allowedRoles: AppRole[];
}

// The three-persona nav structure from A1's spec: "A facilitator sees
// only 'My cohorts.' Partner staff see only 'Cohorts' and 'Reports.'
// Internal admin sees everything." Only Partner Organizations has a
// real screen behind it so far (this PR) - Cohorts and Reports are
// built by A3/A5 respectively; their routes exist now as honest
// not-yet-available placeholders (see app/admin/cohorts,
// app/admin/reports) rather than dead links, so the nav can be built
// and tested correctly per-role today instead of waiting for every
// destination to exist.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/admin/applicants",
    label: () => "Applicants",
    allowedRoles: ["admin"],
  },
  {
    href: "/admin/partners",
    label: () => "Partner organizations",
    allowedRoles: ["admin"],
  },
  {
    href: "/admin/cohorts",
    label: (role) => (role === "facilitator" ? "My cohorts" : "Cohorts"),
    allowedRoles: ["admin", "facilitator", "partner_staff"],
  },
  {
    href: "/admin/reports",
    label: () => "Reports",
    allowedRoles: ["admin", "partner_staff"],
  },
  {
    href: "/admin/data-requests",
    label: () => "Data requests",
    // Admin-only, same as Applicants and Partner organizations - not
    // named in A1's original three-persona spec, but "internal admin
    // sees everything" already covers admin-only tools added later
    // (those two are the precedent). This queue reads member PII
    // fulfillment context, which is not something a partner_staff or
    // facilitator persona has any reason to see.
    allowedRoles: ["admin"],
  },
  {
    href: "/admin/notifications",
    label: () => "Notifications",
    // Admin-only, same reasoning as Data requests directly above - the
    // failed-send queue named in P4's acceptance criteria ("failed sends
    // surface in an admin view").
    allowedRoles: ["admin"],
  },
  {
    href: "/admin/facilitators",
    label: () => "Facilitators",
    // Admin-only - certification data and enforcement details aren't
    // something a facilitator needs a nav entry for to see their own
    // (they don't have a self-service view yet; that's F2/F3's job),
    // and partner_staff has no reason to see certification status at
    // all per A1's persona table.
    allowedRoles: ["admin"],
  },
];

export function navItemsForRole(role: AppRole): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => item.allowedRoles.includes(role));
}
