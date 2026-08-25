"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { COPY } from "@/lib/copy";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** ConfirmDialog hides this so Cancel — not an icon shortcut — is the only close path besides Escape/backdrop. */
  hideCloseButton?: boolean;
}

// Sheet | bottom on mobile, centered dialog on desktop · focus trap, escape
// close, backdrop close, scroll lock. Built on native <dialog>: showModal()
// gives us the focus trap and inert background for free; scroll lock is the
// one thing it doesn't do on its own.
export function Sheet({ open, onClose, title, children, hideCloseButton = false }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      aria-labelledby={titleId}
      className="m-0 w-full max-w-content border-t border-line bg-surface p-0 text-ink backdrop:bg-ink/40 open:fixed open:inset-x-0 open:top-auto open:bottom-0 open:rounded-t-card md:open:inset-0 md:open:m-auto md:open:h-fit md:open:max-h-[85vh] md:open:rounded-card md:open:border"
    >
      <div className="flex max-h-[85vh] flex-col overflow-y-auto p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-h3">
            {title}
          </h2>
          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label={COPY.support.close}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control text-ink-soft hover:bg-action-dim hover:text-action"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
