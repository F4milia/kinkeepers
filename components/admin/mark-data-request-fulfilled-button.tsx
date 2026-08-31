"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { markDataRequestFulfilledAction } from "@/lib/admin/data-requests";

// A note is required (enforced by the DB function too) - this queue is
// explicitly manual-fulfillment-only (see the migration's own comment:
// automated anonymization is unspecified future work), so the note is
// the only record of what an admin actually did to satisfy the request.
export function MarkDataRequestFulfilledButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await markDataRequestFulfilledAction(requestId, note);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          required
          placeholder="Note: what was actually done"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Fulfillment note"
          className="min-h-12 min-w-64 rounded-control border border-line bg-surface px-3 py-2 text-meta font-ui text-ink"
        />
        <Button variant="secondary" disabled={note.trim().length === 0} onClick={() => setOpen(true)}>
          Mark fulfilled
        </Button>
      </div>
      {error ? <p className="text-meta font-ui text-ink">{error}</p> : null}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="Mark this request fulfilled?"
        body={`This records that the request was fulfilled, with the note: "${note}". This cannot be undone from this screen.`}
        confirmLabel={pending ? "Marking fulfilled…" : "Mark fulfilled"}
        cancelLabel="Not yet"
      />
    </div>
  );
}
