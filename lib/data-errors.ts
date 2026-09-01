/**
 * A single marker for "a real data-layer failure happened" (a Supabase
 * query returned an unexpected error, or the fetch to it failed outright).
 * lib/data.ts throws this instead of letting a raw Postgres/fetch error
 * reach a Server Component's render - the nearest route-segment error.tsx
 * catches it and renders L5's error state.
 *
 * Deliberately ONE class covering both "network failure" and "server
 * error" from the prompt, not two: Next.js strips a thrown error down to
 * a bare digest string in production before error.tsx ever sees it
 * (confirmed against Next's own error-boundary docs), so `instanceof`
 * and `.message` checks inside error.tsx cannot reliably distinguish
 * *why* a fetch failed once deployed - only that it did. Both states
 * need the same shape anyway (apologize once, offer retry, offer the
 * phone number), so collapsing them into one boundary is honest about
 * what's actually distinguishable in production, not a shortcut.
 *
 * "Not found" is NOT this class - that's Next's own notFound()/
 * not-found.tsx, a separate and reliably-distinguishable path. Auth
 * expiry is also not this class - the (caregiver)/facilitator layouts
 * redirect to /sign-in before any page renders, so an error boundary
 * never sees it.
 */
export class DataUnavailableError extends Error {
  constructor(message = "Data unavailable", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DataUnavailableError";
  }
}
