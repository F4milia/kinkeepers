"use client";

import { ErrorState } from "@/components/ui/error-state";

/** Route-segment error boundary for /facilitator - see app/(caregiver)/error.tsx for why this must be a Client Component. */
export default function FacilitatorError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState variant="unavailable" onRetry={reset} />;
}
