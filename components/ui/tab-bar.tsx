"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COPY } from "@/lib/copy";

const ITEMS = [
  { href: "/", label: COPY.nav.home },
  { href: "/cohort", label: COPY.nav.cohort },
  { href: "/discussion", label: COPY.nav.discussion },
  { href: "/support", label: COPY.nav.support },
];

// TabBar | mobile bottom bar, desktop left rail · active, focus. Active state
// carries both a background tint and aria-current, not color alone.
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface md:inset-y-0 md:left-0 md:right-auto md:top-0 md:w-56 md:flex-col md:border-r md:border-t-0"
    >
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 flex-1 items-center justify-center px-2 text-label font-ui transition-colors md:flex-none md:justify-start md:px-5 md:py-3 ${
              active ? "bg-action-dim text-action" : "text-ink-soft hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
