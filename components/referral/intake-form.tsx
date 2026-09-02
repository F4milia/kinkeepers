"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { RadioPillGroup } from "@/components/ui/radio-pill-group";
import { CheckboxPillGroup } from "@/components/ui/checkbox-pill-group";
import { COPY, format } from "@/lib/copy";
import { completeIntake, saveIntakeProgress, type IntakeFieldsUpdate } from "@/lib/referral/actions";
import type { SafeApplicantFields } from "@/lib/referral/data";

const STAGE_OPTIONS = [
  { value: "early", label: "Early" },
  { value: "middle", label: "Middle" },
  { value: "late", label: "Late" },
  { value: "unsure", label: COPY.referral.field.stage_unsure },
];

// `value` must be a real IANA identifier - it's stored verbatim as
// applicants.time_zone (lib/referral/actions.ts) with no transformation,
// and every consumer (lib/admin/cohort-meeting-time.ts,
// lib/session-time.ts) feeds it straight into Intl.DateTimeFormat, which
// throws RangeError on a friendly-only string like "Eastern". Matches
// the same four US regions and IANA zones lib/session-time.ts's
// FRIENDLY_ZONE_LABELS already maps back from - keep both in sync if a
// region is ever added here.
const TIME_ZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Los_Angeles", label: "Pacific" },
];

const CONTACT_OPTIONS = [
  { value: "email", label: COPY.referral.field.contact_email },
  { value: "sms", label: COPY.referral.field.contact_sms },
  { value: "both", label: COPY.referral.field.contact_both },
];

const AVAILABILITY_OPTIONS = [
  { value: "weekday_mornings", label: COPY.referral.availability_option.weekday_mornings },
  { value: "weekday_afternoons", label: COPY.referral.availability_option.weekday_afternoons },
  { value: "weekday_evenings", label: COPY.referral.availability_option.weekday_evenings },
  { value: "weekends", label: COPY.referral.availability_option.weekends },
];

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function initialStep(fields: SafeApplicantFields): 1 | 2 | 3 {
  if (asStringArray(fields.availabilityWindows).length > 0 || fields.preferredContactChannel) return 3;
  if (fields.relationship || fields.careRecipientStage || fields.timeZone) return 2;
  return 1;
}

export function IntakeForm({
  resumeToken,
  initialFields,
}: {
  resumeToken: string;
  initialFields: SafeApplicantFields;
}) {
  const alreadyComplete = initialFields.status !== "referred";

  const [step, setStep] = useState<1 | 2 | 3 | "confirmation">(
    alreadyComplete ? "confirmation" : initialStep(initialFields),
  );
  const [firstName, setFirstName] = useState(initialFields.firstName ?? "");
  const [lastName, setLastName] = useState(initialFields.lastName ?? "");
  const [email, setEmail] = useState(initialFields.email ?? "");
  const [phone, setPhone] = useState(initialFields.phone ?? "");
  const [timeZone, setTimeZone] = useState(initialFields.timeZone ?? "");
  const [relationship, setRelationship] = useState(initialFields.relationship ?? "");
  const [stage, setStage] = useState(initialFields.careRecipientStage ?? "");
  const [availability, setAvailability] = useState<string[]>(asStringArray(initialFields.availabilityWindows));
  const [contactPreference, setContactPreference] = useState(initialFields.preferredContactChannel ?? "");
  const [justSaved, setJustSaved] = useState(false);
  const [completeError, setCompleteError] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(update: IntakeFieldsUpdate) {
    setJustSaved(false);
    startTransition(async () => {
      const result = await saveIntakeProgress(resumeToken, update);
      if (result.success) setJustSaved(true);
    });
  }

  function finish() {
    startTransition(async () => {
      const result = await completeIntake(resumeToken);
      if (result.success) {
        setStep("confirmation");
      } else {
        setCompleteError(true);
      }
    });
  }

  if (step === "confirmation") {
    return (
      <Card>
        <p className="text-body font-ui text-ink">{COPY.referral.confirmation.body}</p>
        <p className="mt-4 text-body font-ui text-ink-soft">
          {format(COPY.support.call, { phoneNumber: COPY.support.phoneNumber })}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <p className="text-meta font-ui text-ink-soft">{format(COPY.referral.step_indicator, { n: step })}</p>

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <TextField
            label={COPY.referral.field.first_name}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onBlur={() => save({ firstName })}
          />
          <TextField
            label={COPY.referral.field.last_name}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onBlur={() => save({ lastName })}
          />
          <TextField
            label={COPY.referral.field.email}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => save({ email })}
          />
          <TextField
            label={COPY.referral.field.phone}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => save({ phone })}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-6">
          <TextField
            label={COPY.referral.field.relationship}
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            onBlur={() => save({ relationship })}
          />
          <div className="flex flex-col gap-2">
            <span className="text-label font-ui text-ink">{COPY.referral.field.stage}</span>
            <RadioPillGroup
              name="stage"
              label={COPY.referral.field.stage}
              options={STAGE_OPTIONS}
              value={stage || null}
              onChange={(value) => {
                const typed = value as typeof stage;
                setStage(typed);
                save({ careRecipientStage: typed as "early" | "middle" | "late" | "unsure" });
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-label font-ui text-ink">{COPY.referral.field.time_zone}</span>
            <RadioPillGroup
              name="time-zone"
              label={COPY.referral.field.time_zone}
              options={TIME_ZONE_OPTIONS}
              value={timeZone || null}
              onChange={(value) => {
                setTimeZone(value);
                save({ timeZone: value });
              }}
            />
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-label font-ui text-ink">{COPY.referral.field.availability}</span>
            <CheckboxPillGroup
              label={COPY.referral.field.availability}
              options={AVAILABILITY_OPTIONS}
              value={availability}
              onChange={(value) => {
                setAvailability(value);
                save({ availabilityWindows: value });
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-label font-ui text-ink">{COPY.referral.field.contact_preference}</span>
            <RadioPillGroup
              name="contact-preference"
              label={COPY.referral.field.contact_preference}
              options={CONTACT_OPTIONS}
              value={contactPreference || null}
              onChange={(value) => {
                const typed = value as typeof contactPreference;
                setContactPreference(typed);
                save({ preferredContactChannel: typed as "email" | "sms" | "both" });
              }}
            />
          </div>
        </div>
      ) : null}

      {justSaved ? <p className="text-meta font-ui text-ink-soft">{COPY.referral.saved}</p> : null}
      {completeError ? (
        <p className="text-body font-ui text-ink" role="alert">
          {format(COPY.referral.landing.invalid_link, { phoneNumber: COPY.support.phoneNumber })}
        </p>
      ) : null}

      <div className="flex gap-3">
        {step > 1 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((step - 1) as 1 | 2)}>
            {COPY.referral.back}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="primary"
          className="flex-1"
          loading={pending}
          onClick={() => (step === 3 ? finish() : setStep((step + 1) as 2 | 3))}
        >
          {COPY.referral.next}
        </Button>
      </div>
    </div>
  );
}
