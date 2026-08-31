import { Card } from "@/components/ui/card";
import { StartReferralButton } from "@/components/referral/start-referral-button";
import { COPY, format } from "@/lib/copy";
import { resolvePartnerBySlug } from "@/lib/referral/data";

// L2 | reached via a partner-scoped link. What KinKeepers is, who it's
// for, what happens next, one primary action - per the prompt, deliberately
// not a marketing page: this person was referred by someone they trust
// and is probably exhausted.
export default async function ReferralLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { slug } = await params;
  const { ref: partnerReferenceId } = await searchParams;
  const partner = await resolvePartnerBySlug(slug);

  if (!partner.found) {
    return (
      <Card>
        <p className="text-body font-ui text-ink">
          {format(COPY.referral.landing.invalid_link, { phoneNumber: COPY.support.phoneNumber })}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <p className="text-body font-ui text-ink-soft">
        {format(COPY.referral.landing.referred_by, { name: partner.name })}
      </p>
      <p className="text-body-lg font-ui text-ink">{COPY.referral.landing.blurb}</p>
      <StartReferralButton partnerSlug={slug} partnerReferenceId={partnerReferenceId} />
    </div>
  );
}
