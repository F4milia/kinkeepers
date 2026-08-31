"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { markCohortCompletedAction } from "@/lib/admin/cohort-completion";

// A one-way, consequential lifecycle transition (feeds reporting and
// payout eligibility) - confirmed the same way decline is, per the run
// doc's "every destructive/consequential action confirms" pattern - even
// though this one isn't reversible the way decline is.
export function MarkCohortCompletedButton({ cohortId, cohortName }: { cohortId: string; cohortName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await markCohortCompletedAction(cohortId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Mark completed
      </Button>
      {error ? <p className="text-meta font-ui text-ink">{error}</p> : null}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title={`Mark ${cohortName} completed?`}
        body="This cohort will be marked completed. This does not check whether every session has happened - confirm the group has actually finished before marking it."
        confirmLabel={pending ? "Marking completed…" : "Mark completed"}
        cancelLabel="Not yet"
      />
    </div>
  );
}
