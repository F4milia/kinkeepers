"use client";

import { useState, useTransition } from "react";
import { requestEmailLink } from "@/lib/auth/actions";

// TEMPORARY - not part of the product. Stands in for L1 (the real
// sign-in screen, not yet built) so auth can be tested against the
// live deployment before that screen ships. Calls the same
// requestEmailLink Server Action a real sign-in form would - the point
// is that the magic-link request originates from a real browser
// session, so Supabase's PKCE verifier cookie gets set correctly and
// the emailed link resolves through app/auth/callback the same way it
// would in production. Delete this route once L1 ships.
export default function DebugSignInPage() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const response = await requestEmailLink(email);
      setResult(response.success ? "Link sent - check your email." : `Failed: ${response.reason}`);
    });
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "400px" }}>
      <h1>Temporary debug sign-in</h1>
      <p>Not part of the product - stands in for L1 until it ships.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          style={{ display: "block", width: "100%", marginBottom: "1rem", padding: "0.5rem" }}
        />
        <button type="submit" disabled={pending} style={{ padding: "0.5rem 1rem" }}>
          {pending ? "Sending…" : "Send magic link"}
        </button>
      </form>
      {result ? <p>{result}</p> : null}
    </div>
  );
}
