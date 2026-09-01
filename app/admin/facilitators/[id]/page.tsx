import { notFound } from "next/navigation";
import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { getFacilitatorDetail, addFacilitatorCertificationAction } from "@/lib/admin/facilitators";
import { AddCertificationForm } from "@/components/admin/add-certification-form";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatLongDate } from "@/lib/format-date";

// Admin-only, narrower than app/admin/layout.tsx's allowed set - see
// app/admin/partners/new/page.tsx's comment for why this needs its own
// requireRoleOrRefuse rather than relying on the layout alone.
export default async function FacilitatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = await requireRoleOrRefuse(["admin"]);
  if ("refusal" in result) return result.refusal;

  const { id } = await params;
  const facilitator = await getFacilitatorDetail(id);
  if (!facilitator) notFound();

  const action = addFacilitatorCertificationAction.bind(null, id);

  return (
    <div className="max-w-2xl">
      <h1 className="text-h1 font-heading text-ink">{facilitator.email}</h1>
      <p className="mt-2 text-body font-ui text-ink-soft">
        {facilitator.activeCohortCount} active {facilitator.activeCohortCount === 1 ? "cohort" : "cohorts"} ·{" "}
        {facilitator.sessionsNext7Days} {facilitator.sessionsNext7Days === 1 ? "session" : "sessions"} in the next 7
        days
      </p>

      <section aria-labelledby="certifications-heading" className="mt-8 flex flex-col gap-3">
        <h2 id="certifications-heading" className="text-h3 font-heading text-ink">
          Certifications
        </h2>
        {facilitator.certifications.length === 0 ? (
          <p className="text-body font-ui text-ink-soft">No certifications on record.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {facilitator.certifications.map((cert) => (
              <li key={cert.id}>
                <Card className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-body font-ui font-medium text-ink">{cert.programName}</p>
                    <p className="text-meta font-ui text-ink-soft">
                      {cert.certifyingBody} · {formatLongDate(cert.certifiedOn)} – {formatLongDate(cert.expiresOn)}
                    </p>
                  </div>
                  {cert.isExpired ? (
                    <Badge variant="urgent">Expired</Badge>
                  ) : cert.isExpiringSoon ? (
                    <Badge variant="gentle">Expires soon</Badge>
                  ) : (
                    <Badge variant="accent">Current</Badge>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="add-certification-heading" className="mt-8 flex flex-col gap-3">
        <h2 id="add-certification-heading" className="text-h3 font-heading text-ink">
          Record a certification
        </h2>
        {facilitator.allPrograms.length === 0 ? (
          <p className="text-body font-ui text-ink-soft">No licensed programs to certify against yet.</p>
        ) : (
          <AddCertificationForm action={action} programs={facilitator.allPrograms} />
        )}
      </section>
    </div>
  );
}
