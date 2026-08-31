import { ConsentDocumentSection } from "@/components/consent/consent-document-section";
import { COPY } from "@/lib/copy";
import { getConsentStatus } from "@/lib/consent/data";

// L3, consent section. Lives inside (caregiver) - already gated behind a
// real signed-in session (L1), which is what getConsentStatus() needs.
// All four documents shown, not just pending ones: an already-agreed
// document still needs somewhere readable to link to (the Discussion
// screen's confidentiality line).
export default async function ConsentPage() {
  const documents = await getConsentStatus();
  const allDone = documents.length > 0 && documents.every((doc) => doc.status === "consented");

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-h2">{COPY.consent.title}</h1>
      {allDone ? <p className="text-body font-ui text-ink-soft">{COPY.consent.all_done}</p> : null}
      {documents.map((doc) => (
        <ConsentDocumentSection key={doc.documentType} doc={doc} />
      ))}
    </div>
  );
}
