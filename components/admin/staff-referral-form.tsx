"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import { COPY } from "@/lib/copy";
import type { StaffReferralFormState } from "@/lib/referral/actions";

const INITIAL_STATE: StaffReferralFormState = { status: "idle", fieldErrors: {} };

const FIELD_CLASSES =
  "min-h-12 w-full rounded-control border border-line bg-surface px-4 py-3 text-body font-ui text-ink placeholder:text-ink-soft";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-meta font-ui text-ink">{message}</p>;
}

export function StaffReferralForm({
  action,
}: {
  action: (
    prevState: StaffReferralFormState,
    formData: FormData,
  ) => Promise<StaffReferralFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  if (state.status === "success" && state.resumeUrl) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-h3 font-heading text-ink">{COPY.referral.staff.success_heading}</p>
        <p className="text-body font-ui text-ink">{COPY.referral.staff.success_body}</p>
        <p className="min-h-12 break-all rounded-control border border-line bg-surface px-4 py-3 text-body font-ui text-action">
          {state.resumeUrl}
        </p>
        <Link href="/admin/refer" className={buttonClasses("secondary")}>
          {COPY.referral.staff.create_another}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="partnerReferenceId" className="text-label font-ui text-ink">
          {COPY.referral.staff.partner_reference_id_label}
        </label>
        <input
          id="partnerReferenceId"
          name="partnerReferenceId"
          type="text"
          maxLength={64}
          aria-invalid={!!state.fieldErrors.partnerReferenceId || undefined}
          aria-describedby={state.fieldErrors.partnerReferenceId ? "partnerReferenceId-error" : undefined}
          className={FIELD_CLASSES}
        />
        <FieldError message={state.fieldErrors.partnerReferenceId} />
      </div>

      {state.formError ? <p className="text-meta font-ui text-ink">{state.formError}</p> : null}

      <Button type="submit" loading={pending}>
        {COPY.referral.staff.submit}
      </Button>
    </form>
  );
}
