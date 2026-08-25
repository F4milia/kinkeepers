import type { ReactNode } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { SupportAffordance } from "@/components/support-affordance";
import { DevViewSwitcher } from "@/components/dev-view-switcher";
import type { DevView } from "@/lib/dev-view";

/**
 * Single column, 620px max. Bottom tab bar on mobile, left rail on desktop
 * (both from TabBar). The support bar is sticky above the content so it
 * never scrolls out of reach, and sits outside the 3-destination nav — it
 * isn't a fourth page, it's a phone number.
 *
 * The dev view switcher renders just above it, but deliberately isn't part
 * of that sticky block: it's demo scaffolding, not a real affordance, and
 * stacking it into the sticky header doubles the band at the top of the
 * viewport that scrolled content can't be clicked through — a real, tested
 * regression for a persistent element. Letting it scroll away with the page
 * avoids that while still reading as "not part of the product."
 */
export function AppShell({ children, initialDevView }: { children: ReactNode; initialDevView: DevView }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <TabBar />
      <div className="md:pl-56">
        <DevViewSwitcher initialView={initialDevView} />
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
