"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSelfReferral } from "@/lib/referral/actions";
import { Button } from "@/components/ui/button";
import { COPY, format } from "@/lib/copy";

export function StartReferralButton({
  partnerSlug,
  partnerReferenceId,
}: {
  partnerSlug: string;
  partnerReferenceId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await createSelfReferral(partnerSlug, partnerReferenceId);
      if (result.success) {
        router.push(`/intake/${result.resumeToken}`);
        return;
      }
      setError(format(COPY.referral.landing.invalid_link, { phoneNumber: COPY.support.phoneNumber }));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Button type="button" variant="primary" loading={pending} onClick={start}>
        {COPY.referral.landing.start}
      </Button>
      {error ? (
        <p className="text-body font-ui text-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
