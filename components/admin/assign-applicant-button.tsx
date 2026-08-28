"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { assignApplicantToCohortAction } from "@/lib/admin/assignment";

// Assignment is forward-moving, not destructive (nothing is lost or
// reversed), so unlike decline it doesn't get the confirm-dialog
// treatment - a plain audited action, same as reopen.
export function AssignApplicantButton({ applicantId, cohortId }: { applicantId: string; cohortId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await assignApplicantToCohortAction(applicantId, cohortId);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="primary" onClick={handleClick} loading={pending}>
        Assign
      </Button>
      {error ? <p className="text-meta font-ui text-ink">{error}</p> : null}
    </div>
  );
}
