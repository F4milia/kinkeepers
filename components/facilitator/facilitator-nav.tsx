"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COPY } from "@/lib/copy";

const ITEMS = [
  { href: "/facilitator", label: COPY.facilitator.nav.home },
  { href: "/facilitator/schedule", label: COPY.facilitator.nav.schedule },
];

// Two destinations only — no third-tab equivalent to the caregiver
// TabBar's Discussion here, so a simple top row rather than a bottom bar
// (which this codebase reserves for the 3-destination caregiver nav).
export function FacilitatorNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex gap-2">
      {ITEMS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`min-h-12 border-b-2 px-4 py-3 text-label font-ui ${
              active ? "border-action text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
