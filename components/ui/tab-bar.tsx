"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";
import { COPY } from "@/lib/copy";

// Icons are recognition aids beside the label, never a replacement for it —
// this audience includes people who won't decode a glyph on its own. All
// aria-hidden: the link text is the accessible name.
function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.5V20h13V9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGroup(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
      <path d="M16 5.5a3.25 3.25 0 0 1 0 6.5M17.5 19.5a5.5 5.5 0 0 0-2-4.2" strokeLinecap="round" />
    </svg>
  );
}

function IconDiscussion(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M20 14.5a2 2 0 0 1-2 2H8l-4 3.5v-14a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" strokeLinejoin="round" />
    </svg>
  );
}

const ITEMS = [
  { href: "/", label: COPY.nav.home, Icon: IconHome },
  { href: "/cohort", label: COPY.nav.cohort, Icon: IconGroup },
  { href: "/discussion", label: COPY.nav.discussion, Icon: IconDiscussion },
];

// TabBar | mobile bottom bar, desktop left rail · active, focus. Active state
// carries a filled pill, an icon, and aria-current — never color alone.
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface p-1.5 md:inset-y-0 md:left-0 md:right-auto md:top-0 md:w-56 md:flex-col md:gap-1 md:border-r md:border-t-0 md:p-3"
    >
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-control px-2 text-label font-ui transition-colors md:flex-none md:flex-row md:justify-start md:gap-3 md:px-4 md:py-3 ${
              active
                ? "bg-action-dim text-action"
                : "text-ink-soft hover:bg-action-dim hover:text-ink"
            }`}
          >
            <Icon className="h-6 w-6 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
