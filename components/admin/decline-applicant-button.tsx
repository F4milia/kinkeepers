"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { declineApplicantAction } from "@/lib/admin/applicants";
import { DECLINE_REASONS, type DeclineReason } from "@/lib/admin/decline-reasons";

// Decline is a destructive action per the run doc's global rule ("every
// destructive action confirms, and the confirm dialog names what will
// happen") - reopening it later is possible, but the reviewer should
// still see exactly what they're about to do before it's audited.
export function DeclineApplicantButton({
  applicantId,
  applicantName,
}: {
  applicantId: string;
  applicantName: string;
}) {
  const [reason, setReason] = useState<DeclineReason>(DECLINE_REASONS[0].value);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reasonLabel = DECLINE_REASONS.find((r) => r.value === reason)?.label ?? reason;

  function handleConfirm() {
    startTransition(async () => {
      const result = await declineApplicantAction(applicantId, reason);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={reason}
        onChange={(event) => setReason(event.target.value as DeclineReason)}
        aria-label={`Decline reason for ${applicantName}`}
        className="min-h-10 rounded-control border border-line bg-surface px-2 text-meta font-ui text-ink"
      >
        {DECLINE_REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Decline
      </Button>
      {error ? <p className="text-meta font-ui text-ink">{error}</p> : null}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title={`Decline ${applicantName}?`}
        body={`${applicantName} will be marked declined (reason: "${reasonLabel}") and removed from the review queue. You can reopen them later if this changes.`}
        confirmLabel={pending ? "Declining…" : "Decline"}
        cancelLabel="Keep in queue"
      />
    </div>
  );
}
