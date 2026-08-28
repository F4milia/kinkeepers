import type { ReactNode } from "react";
import { SupportAffordance } from "@/components/support-affordance";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Theme } from "@/lib/theme";

/**
 * Minimal shell for applicant-status screens (L4) — no TabBar. AppShell's
 * three destinations (Home, My group, Discussion) all assume an assigned
 * cohort, which an applicant doesn't have yet; reusing it would put two
 * broken nav items in front of someone who hasn't been assigned one.
 * Support affordance stays, per CLAUDE.md's phone-number-in-every-state rule.
 */
export function ApplicantShell({ children, theme }: { children: ReactNode; theme: Theme }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-end gap-2 px-4 py-2">
          <ThemeToggle initialTheme={theme} />
          <SupportAffordance />
        </div>
      </header>
      <main className="mx-auto max-w-content px-4 pb-10 pt-6">{children}</main>
    </div>
  );
}
