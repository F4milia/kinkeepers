// EmptyState | headline + body, no illustration. Empty states acknowledge
// reality (CLAUDE.md) — copy comes from the caller, sourced from Part 3.1.
export function EmptyState({ headline, body }: { headline: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-section text-center">
      <p className="text-h3 font-heading text-ink">{headline}</p>
      <p className="text-body font-ui text-ink-soft">{body}</p>
    </div>
  );
}
