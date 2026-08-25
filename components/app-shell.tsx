import type { ReactNode } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { SupportAffordance } from "@/components/support-affordance";

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
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <TabBar />
      <div className="md:pl-56">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas">
          <div className="mx-auto flex max-w-content justify-end px-4 py-2">
            <SupportAffordance />
          </div>
        </header>
        <main className="mx-auto max-w-content px-4 pb-24 pt-6 md:pb-10">{children}</main>
      </div>
    </div>
  );
}
