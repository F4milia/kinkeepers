"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type {
  PartnerOrganization,
  PartnerOrganizationFormState,
} from "@/lib/admin/partner-organizations";

const INITIAL_STATE: PartnerOrganizationFormState = { status: "idle", fieldErrors: {} };

const FIELD_CLASSES =
  "min-h-12 w-full rounded-control border border-line bg-surface px-4 py-3 text-body font-ui text-ink placeholder:text-ink-soft";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-meta font-ui text-ink">{message}</p>;
}

export function PartnerOrganizationForm({
  action,
  initial,
  submitLabel,
}: {
  action: (
    prevState: PartnerOrganizationFormState,
    formData: FormData,
  ) => Promise<PartnerOrganizationFormState>;
  initial?: PartnerOrganization;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-label font-ui text-ink">
          Organization name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={initial?.name}
          aria-invalid={!!state.fieldErrors.name || undefined}
          aria-describedby={state.fieldErrors.name ? "name-error" : undefined}
          className={FIELD_CLASSES}
        />
        <FieldError message={state.fieldErrors.name} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="referralLinkSlug" className="text-label font-ui text-ink">
          Referral link slug
        </label>
        <input
          id="referralLinkSlug"
          name="referralLinkSlug"
          type="text"
          defaultValue={initial?.referral_link_slug}
          aria-invalid={!!state.fieldErrors.referralLinkSlug || undefined}
          aria-describedby={state.fieldErrors.referralLinkSlug ? "referralLinkSlug-error" : undefined}
          className={FIELD_CLASSES}
        />
        <p className="text-meta font-ui text-ink-soft">
          Lowercase letters, numbers, and hyphens only. Appears in the referral link this
          organization shares with caregivers.
        </p>
        <FieldError message={state.fieldErrors.referralLinkSlug} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-label font-ui text-ink">Status</legend>
        <div className="flex gap-4">
          <label className="flex min-h-12 items-center gap-2 text-body font-ui text-ink">
            <input
              type="radio"
              name="status"
              value="active"
              defaultChecked={(initial?.status ?? "active") === "active"}
            />
            Active
          </label>
          <label className="flex min-h-12 items-center gap-2 text-body font-ui text-ink">
            <input
              type="radio"
              name="status"
              value="inactive"
              defaultChecked={initial?.status === "inactive"}
            />
            Inactive
          </label>
        </div>
      </fieldset>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="contractStart" className="text-label font-ui text-ink">
            Contract start
          </label>
          <input
            id="contractStart"
            name="contractStart"
            type="date"
            defaultValue={initial?.contract_start ?? ""}
            className={FIELD_CLASSES}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="contractEnd" className="text-label font-ui text-ink">
            Contract end
          </label>
          <input
            id="contractEnd"
            name="contractEnd"
            type="date"
            defaultValue={initial?.contract_end ?? ""}
            className={FIELD_CLASSES}
          />
        </div>
      </div>
      <FieldError message={state.fieldErrors.contractDates} />

      <div className="flex flex-col gap-2">
        <label htmlFor="notes" className="text-label font-ui text-ink">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={initial?.notes ?? ""}
          className={FIELD_CLASSES}
        />
      </div>

      {state.formError ? <p className="text-meta font-ui text-ink">{state.formError}</p> : null}

      <div className="flex gap-4">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
