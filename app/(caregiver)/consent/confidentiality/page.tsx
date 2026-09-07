import { ConsentDocumentSection } from "@/components/consent/consent-document-section";
import { COPY } from "@/lib/copy";
import { getConsentStatus } from "@/lib/consent/data";

// L3: group confidentiality's own screen, separate from /consent's other
// three documents - "gets its own screen and its own moment," per the run
// doc's own text, not just another checkbox in the same list. The page's
// own heading names the document directly, rather than the generic
// "Agreements" title /consent uses.
export default async function ConsentConfidentialityPage() {
  const documents = await getConsentStatus();
  const doc = documents.find((d) => d.documentType === "group_confidentiality");
  if (!doc) return null;

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-h2">{COPY.consent.title}</h1>
      <ConsentDocumentSection doc={doc} />
    </div>
  );
}
