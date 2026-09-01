import { Card } from "@/components/ui/card";
import { unsubscribeFromNotifications } from "@/lib/referral/unsubscribe";
import { COPY } from "@/lib/copy";

// PLACEHOLDER COPY: no real copy exists for this page anywhere in the
// available companion docs (same gap flagged in
// lib/messaging/session-notifications.ts and lib/referral/send-resume-email.ts
// for the messages that link here) - minimal and functionally
// descriptive only, not final. Reuses the copy deck's own phone number
// constant rather than inventing a second one.
//
// Public, token-based - see lib/referral/unsubscribe.ts for why no
// signed-in session is required here.
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await unsubscribeFromNotifications(token);

  return (
    <Card>
      <p className="text-body font-ui text-ink">
        {result.success
          ? `You won't get any more meeting emails or texts. If this was a mistake, call ${COPY.support.phoneNumber} and we can turn it back on.`
          : `${result.error} Call ${COPY.support.phoneNumber} and we can help.`}
      </p>
    </Card>
  );
}
