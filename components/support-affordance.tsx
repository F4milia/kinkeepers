"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { COPY, format } from "@/lib/copy";

const TEL_HREF = `tel:+${COPY.support.phoneNumber.replace(/\D/g, "")}`;

/**
 * The 24/7 support affordance — persistent on every screen, never scrolls
 * out of reach. The only element that uses --urgent (CLAUDE.md). Opens
 * straight to a phone number: no form, no chatbot, no triage questions.
 */
export function SupportAffordance() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-urgent px-4 text-label font-ui text-surface transition-colors hover:bg-urgent/90"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 4h3l1.5 4L7.5 9.5a9 9 0 0 0 4 4L13 12l4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A13.5 13.5 0 0 1 4 5.6 1.5 1.5 0 0 1 5.5 4Z"
          />
        </svg>
        {COPY.nav.support}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={COPY.support.title}>
        <p className="text-body font-ui text-ink">{COPY.support.body}</p>
        <a
          href={TEL_HREF}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-control bg-action px-6 text-label font-ui text-surface transition-colors hover:bg-action/90"
        >
          {format(COPY.support.call, { phoneNumber: COPY.support.phoneNumber })}
        </a>
        <p className="mt-4 text-meta font-ui text-ink-soft">{COPY.support.note}</p>
      </Sheet>
    </>
  );
}
