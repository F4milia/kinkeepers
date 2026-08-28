"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reopenApplicantAction } from "@/lib/admin/applicants";

// Reopen is corrective, not destructive - it undoes a decline, so it
// doesn't need the confirm-dialog treatment decline gets.
export function ReopenApplicantButton({ applicantId }: { applicantId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await reopenApplicantAction(applicantId);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={handleClick} loading={pending}>
        Reopen
      </Button>
      {error ? <p className="text-meta font-ui text-ink">{error}</p> : null}
    </div>
  );
}
