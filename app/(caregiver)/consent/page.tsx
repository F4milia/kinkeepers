import Link from "next/link";
import { ConsentDocumentSection } from "@/components/consent/consent-document-section";
import { buttonClasses } from "@/components/ui/button";
import { COPY } from "@/lib/copy";
import { getConsentStatus } from "@/lib/consent/data";

// L3, consent section. Lives inside (caregiver) - already gated behind a
// real signed-in session (L1), which is what getConsentStatus() needs.
//
// Two screens, not one: this page carries terms/privacy/participant
// agreement; group_confidentiality lives on its own screen
// (/consent/confidentiality) - the run doc's own text is explicit that it
// "gets its own screen and its own moment," not just another checkbox in
// the same list. All three shown here even once consented (not just
// pending), since an already-agreed document still needs somewhere
// readable to link back to.
export default async function ConsentPage() {
  const documents = (await getConsentStatus()).filter((doc) => doc.documentType !== "group_confidentiality");
  const allDone = documents.length > 0 && documents.every((doc) => doc.status === "consented");

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-h2">{COPY.consent.title}</h1>
      {documents.map((doc) => (
        <ConsentDocumentSection key={doc.documentType} doc={doc} />
      ))}
      {allDone ? (
        <Link href="/consent/confidentiality" className={`w-fit ${buttonClasses("primary")}`}>
          {COPY.consent.continue_to_confidentiality}
        </Link>
      ) : null}
    </div>
  );
}
