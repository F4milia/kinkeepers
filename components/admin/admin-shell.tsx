import Link from "next/link";
import type { AppRole } from "@/lib/auth/roles";
import { navItemsForRole } from "@/lib/admin/nav";

/**
 * The admin shell - deliberately NOT the caregiver AppShell (bottom tab
 * bar, 620px max-width, single column). CLAUDE.md: "The /admin layout
 * density exemption applies to /admin only." A desk user on a laptop
 * gets a left nav + wide content area; reuses the same design tokens
 * (fonts, colors, focus rings) as the caregiver app rather than a
 * second design system, just a different layout shape.
 *
 * Nav renders by role (hide-by-role is a courtesy) - the actual
 * security is every route's own requireRole() check, enforced
 * server-side regardless of what this component shows.
 */
export function AdminShell({ role, children }: { role: AppRole; children: React.ReactNode }) {
  const navItems = navItemsForRole(role);

  return (
    <div className="min-h-dvh bg-canvas font-ui text-ink">
      <div className="mx-auto flex max-w-6xl">
        <nav
          aria-label="Admin navigation"
          className="sticky top-0 h-dvh w-56 shrink-0 border-r border-line bg-surface px-3 py-6"
        >
          <p className="px-3 pb-4 text-h3 font-heading text-ink">KinKeepers admin</p>
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block min-h-12 rounded-control px-3 py-3 text-label font-ui text-ink hover:bg-action-dim focus-visible:bg-action-dim"
                >
                  {item.label(role)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
