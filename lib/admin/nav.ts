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
];

export function navItemsForRole(role: AppRole): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => item.allowedRoles.includes(role));
}
