import type { ReactNode } from "react";
import { FacilitatorNav } from "@/components/facilitator/facilitator-nav";
import { SupportAffordance } from "@/components/support-affordance";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Theme } from "@/lib/theme";

/**
 * Shell for the facilitator app (F1) — two destinations (Home, Schedule),
 * not the caregiver TabBar's three, and not the /admin density exemption
 * (facilitator screens follow the same design constraints as member
 * screens per CLAUDE.md). A top nav row rather than a bottom bar since
 * there's no third item to justify the caregiver shell's mobile pattern.
 */
export function FacilitatorShell({ children, theme }: { children: ReactNode; theme: Theme }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-2 px-4 py-2">
          <FacilitatorNav />
          <div className="flex items-center gap-2">
            <ThemeToggle initialTheme={theme} />
            <SupportAffordance />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-content px-4 pb-10 pt-6">{children}</main>
    </div>
  );
}
