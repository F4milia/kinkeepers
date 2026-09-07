"use client";

import { ErrorState } from "@/components/ui/error-state";

/**
 * Route-segment error boundary for /facilitator - see
 * app/(caregiver)/error.tsx for why this must be a Client Component,
 * and for why retry does a full `window.location.reload()` rather than
 * Next's own `reset` prop (2026-09-08 L5 acceptance audit) - this
 * boundary sits below FacilitatorLayout's own auth check the same way,
 * so a scoped reset() could never recover a session that actually
 * expired mid-request.
 */
export default function FacilitatorError() {
  return <ErrorState variant="unavailable" onRetry={() => window.location.reload()} />;
}
