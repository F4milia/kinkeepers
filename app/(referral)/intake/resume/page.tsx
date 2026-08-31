import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { COPY, format } from "@/lib/copy";

// The link lib/referral/send-resume-email.ts actually mails
// (`${site}/intake/resume?token=...`) - a thin redirect into the real
// form route so the emailed URL never needs to know the resume token is
// also the route segment.
export default async function IntakeResumePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Card>
        <p className="text-body font-ui text-ink">
          {format(COPY.referral.landing.invalid_link, { phoneNumber: COPY.support.phoneNumber })}
        </p>
      </Card>
    );
  }

  redirect(`/intake/${token}`);
}
