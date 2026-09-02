import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { COPY } from "@/lib/copy";
import { getMyCertifications } from "@/lib/data";
import { formatLongDate } from "@/lib/format-date";

// F2 | a facilitator's own read-only view of their certifications - the
// self-service screen lib/admin/nav.ts and facilitator_certifications.sql
// both named as "F2/F3's job" when A4-cert granted
// facilitator_certifications_select_own in anticipation of it. No add/edit
// form here - certification data entry stays admin-only (A4-cert), same
// as every other admin-managed table.
export default async function FacilitatorCertificationsPage() {
  const certifications = await getMyCertifications();

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-h2">{COPY.facilitator.certifications.title}</h1>

      {certifications.length === 0 ? (
        <Card>
          <EmptyState headline={COPY.facilitator.certifications.title} body={COPY.facilitator.certifications.empty} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {certifications.map((cert) => (
            <li key={cert.id}>
              <Card className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-body font-ui font-medium text-ink">{cert.programName}</p>
                  <p className="text-meta font-ui text-ink-soft">
                    {cert.certifyingBody} · {formatLongDate(cert.certifiedOn)} – {formatLongDate(cert.expiresOn)}
                  </p>
                </div>
                {cert.isExpired ? (
                  <Badge variant="urgent">{COPY.facilitator.certifications.expired}</Badge>
                ) : cert.isExpiringSoon ? (
                  <Badge variant="gentle">{COPY.facilitator.certifications.expiring_soon}</Badge>
                ) : (
                  <Badge variant="accent">{COPY.facilitator.certifications.current}</Badge>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
