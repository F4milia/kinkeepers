import { Card } from "@/components/ui/card";
import { IntakeForm } from "@/components/referral/intake-form";
import { COPY, format } from "@/lib/copy";
import { resolveApplicantByResumeToken } from "@/lib/referral/data";

// L2 | reached either right after the referral landing page, or from the
// resume-link email (P2's sendResumeEmail -> /intake/resume -> here).
// resume_token, not a session, is what authorizes this - same boundary
// lib/referral/data.ts's resolveApplicantByResumeToken already enforces.
export default async function IntakePage({
  params,
}: {
  params: Promise<{ resumeToken: string }>;
}) {
  const { resumeToken } = await params;
  const result = await resolveApplicantByResumeToken(resumeToken);

  if (!result.found) {
    return (
      <Card>
        <p className="text-body font-ui text-ink">
          {format(COPY.referral.landing.invalid_link, { phoneNumber: COPY.support.phoneNumber })}
        </p>
      </Card>
    );
  }

  return <IntakeForm resumeToken={resumeToken} initialFields={result.fields} />;
}
