"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { AddCertificationFormState } from "@/lib/admin/facilitators";

const INITIAL_STATE: AddCertificationFormState = { status: "idle", fieldErrors: {} };

const FIELD_CLASSES =
  "min-h-12 w-full rounded-control border border-line bg-surface px-4 py-3 text-body font-ui text-ink placeholder:text-ink-soft";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-meta font-ui text-ink">{message}</p>;
}

export function AddCertificationForm({
  action,
  programs,
}: {
  action: (
    prevState: AddCertificationFormState,
    formData: FormData,
  ) => Promise<AddCertificationFormState>;
  programs: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="programId" className="text-label font-ui text-ink">
          Program
        </label>
        <select id="programId" name="programId" className={FIELD_CLASSES} defaultValue="">
          <option value="" disabled>
            Choose a program
          </option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors.programId} />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="certifiedOn" className="text-label font-ui text-ink">
            Certified on
          </label>
          <input id="certifiedOn" name="certifiedOn" type="date" className={FIELD_CLASSES} />
          <FieldError message={state.fieldErrors.certifiedOn} />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="expiresOn" className="text-label font-ui text-ink">
            Expires on
          </label>
          <input id="expiresOn" name="expiresOn" type="date" className={FIELD_CLASSES} />
          <FieldError message={state.fieldErrors.expiresOn} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="certifyingBody" className="text-label font-ui text-ink">
          Certifying body
        </label>
        <input id="certifyingBody" name="certifyingBody" type="text" className={FIELD_CLASSES} />
        <FieldError message={state.fieldErrors.certifyingBody} />
      </div>

      {state.formError ? <p className="text-meta font-ui text-ink">{state.formError}</p> : null}

      <div className="flex gap-4">
        <Button type="submit" loading={pending}>
          Record certification
        </Button>
      </div>
    </form>
  );
}
