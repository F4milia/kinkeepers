"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { COPY, format } from "@/lib/copy";
import { formatLongDate } from "@/lib/format-date";
import { recordConsent } from "@/lib/consent/actions";
import type { ConsentDocumentStatus } from "@/lib/consent/data";

// L3 | one section per document: full text readable on the screen, its
// own checkbox (not one checkbox for all four, per the prompt).
// group_confidentiality gets its own intro paragraph above the text -
// "its own screen and its own moment" - the other three don't.
export function ConsentDocumentSection({ doc }: { doc: ConsentDocumentStatus }) {
  const [checked, setChecked] = useState(false);
  const [agreed, setAgreed] = useState(doc.status === "consented");
  const [agreedAt, setAgreedAt] = useState(doc.agreedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const documentName = COPY.consent.document_name[doc.documentType];

  function agree() {
    setError(null);
    startTransition(async () => {
      const result = await recordConsent(doc.documentType, doc.version);
      if (result.success) {
        setAgreed(true);
        setAgreedAt(new Date().toISOString());
      } else {
        // Realistically only reachable if the session expired mid-read -
        // the (caregiver) layout already blocks a signed-out visitor from
        // ever reaching this page. Still needs a visible state rather
        // than the button silently going idle with nothing agreed.
        setError(COPY.error.load_failed);
      }
    });
  }

  return (
    <section id={doc.documentType} aria-labelledby={`${doc.documentType}-heading`} className="flex flex-col gap-4">
      <h2 id={`${doc.documentType}-heading`} className="text-h3">
        {documentName}
      </h2>

      {doc.documentType === "group_confidentiality" ? (
        <p className="text-body font-ui text-ink">{COPY.consent.group_confidentiality_intro}</p>
      ) : null}

      <Card className="max-h-64 overflow-y-auto">
        <p className="whitespace-pre-wrap text-body font-ui text-ink">{doc.body}</p>
      </Card>

      {agreed ? (
        <p className="text-meta font-ui text-ink-soft">
          {format(COPY.consent.consented_on, { date: formatLongDate((agreedAt ?? "").slice(0, 10)) })}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex min-h-12 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="h-6 w-6 shrink-0"
            />
            <span className="text-body font-ui text-ink">
              {format(COPY.consent.checkbox_label, { documentName })}
            </span>
          </label>
          <Button type="button" variant="primary" disabled={!checked} loading={pending} onClick={agree}>
            {COPY.consent.agree}
          </Button>
          {error ? (
            <p className="text-body font-ui text-ink" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
