"use client";

import { useEffect, useState, useTransition } from "react";
import { requestEmailLink } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { COPY, format } from "@/lib/copy";

const RESEND_COOLDOWN_SECONDS = 60;

type SentState = { status: "sent"; email: string };
type FormState = { status: "idle" } | SentState;

// L1, email-only for now (see lib/copy.ts's sign_in section for why).
// Same input handles both a returning member and a brand-new one — no
// "have an account?" distinction, per the prompt. A genuinely new email
// currently lands on the same fixture-driven Home as everyone else after
// verifying (L2's intake doesn't exist yet to route to instead) - flagged
// in this PR's description, not silently patched over here.
export function SignInForm({
  linkInvalid,
  sessionExpired = false,
}: {
  linkInvalid: boolean;
  /** L5: routed here from (caregiver)/facilitator's layout when a real, previously-valid session is no longer valid - see lib/auth/roles.ts's getSignedOutReason. */
  sessionExpired?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [showLinkInvalid, setShowLinkInvalid] = useState(linkInvalid);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function send(targetEmail: string) {
    setShowLinkInvalid(false);
    setError(null);
    startTransition(async () => {
      const result = await requestEmailLink(targetEmail);
      if (result.success) {
        setState({ status: "sent", email: targetEmail });
        setCooldown(RESEND_COOLDOWN_SECONDS);
        return;
      }
      if (result.reason === "invalid_input") {
        setError(COPY.sign_in.error_invalid_email);
      } else if (result.reason === "rate_limited") {
        setError(format(COPY.sign_in.error_rate_limited, { phoneNumber: COPY.support.phoneNumber }));
      } else {
        setError(COPY.sign_in.error_send_failed);
      }
    });
  }

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h2">{COPY.sign_in.title}</h1>
        <p className="text-body font-ui text-ink">{format(COPY.sign_in.sent_body, { email: state.email })}</p>
        <Button
          type="button"
          variant="secondary"
          disabled={cooldown > 0}
          loading={pending}
          onClick={() => send(state.email)}
        >
          {cooldown > 0 ? format(COPY.sign_in.resend_countdown, { n: cooldown }) : COPY.sign_in.resend}
        </Button>
        {error ? (
          <p className="text-body font-ui text-ink" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send(email);
      }}
      className="flex flex-col gap-4"
    >
      <h1 className="text-h2">{sessionExpired ? COPY.errors.auth_expired.headline : COPY.sign_in.title}</h1>

      {sessionExpired ? (
        <p className="text-body font-ui text-ink-soft">{COPY.errors.auth_expired.body}</p>
      ) : null}

      {showLinkInvalid ? (
        <p className="text-body font-ui text-ink" role="alert">
          {COPY.sign_in.error_link_invalid}
        </p>
      ) : null}

      <TextField
        label={COPY.sign_in.email_label}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={error ?? undefined}
      />

      <Button type="submit" variant="primary" loading={pending}>
        {COPY.sign_in.send_link}
      </Button>
    </form>
  );
}
