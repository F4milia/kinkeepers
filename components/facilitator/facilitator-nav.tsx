"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COPY } from "@/lib/copy";

const ITEMS = [
  { href: "/facilitator", label: COPY.facilitator.nav.home },
  { href: "/facilitator/schedule", label: COPY.facilitator.nav.schedule },
  { href: "/facilitator/certifications", label: COPY.facilitator.nav.certifications },
];

// F2 added a third destination (Certifications) - still a simple top row,
// not the caregiver TabBar's bottom-bar treatment, which this codebase
// reserves specifically for that 3-destination member nav, not just any
// nav that happens to reach three items.
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
