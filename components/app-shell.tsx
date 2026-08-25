import type { ReactNode } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { SupportAffordance } from "@/components/support-affordance";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Theme } from "@/lib/theme";

/**
 * Single column, 620px max. Bottom tab bar on mobile, left rail on desktop
 * (both from TabBar). The support bar is sticky above the content so it
 * never scrolls out of reach, and sits outside the 3-destination nav — it
 * isn't a fourth page, it's a phone number.
 *
 * The dev view switcher deliberately does NOT live here. It only controls
 * /session/[sessionId] — the one route that renders differently for a
 * caregiver and a facilitator — so it renders there, directly above the
 * view it switches. Mounting it in the shell put demo scaffolding at the
 * top of every screen where it did nothing but interrupt the flow.
 */
export function AppShell({ children, theme }: { children: ReactNode; theme: Theme }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <TabBar />
      <div className="md:pl-56">
        {/* Theme toggle sits with the support affordance rather than on Home
            (Part 3.4's placement) so the reading canvas starts at the
            greeting, and so it's reachable from every screen — a caregiver
            who opens the app at 3am shouldn't have to navigate Home to dim
            it. Wraps rather than shrinks at 320px: both stay 48px targets. */}
        <header className="sticky top-0 z-30 border-b border-line bg-canvas">
          <div className="mx-auto flex max-w-content flex-wrap items-center justify-end gap-2 px-4 py-2">
            <ThemeToggle initialTheme={theme} />
            <SupportAffordance />
          </div>
        </header>
        <main className="mx-auto max-w-content px-4 pb-24 pt-6 md:pb-10">{children}</main>
      </div>
    </div>
  );
}
