/**
 * @file Ruta /opportunities/[id]. Presenta una oportunidad publicada y permite gestionar su marcador.
 */

import { Briefcase01Icon, Calendar03Icon, Location01Icon, Note01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "../../../components/back-link";
import { primaryButtonClass, secondaryButtonClass } from "../../../components/form-styles";
import {
  OpportunityBookmark,
  OpportunityDate,
  opportunityStatusMessages,
  opportunityTypeLabels,
} from "../../../components/opportunity-listing";
import { PageHeading, pageClassName } from "../../../components/page-layout";
import {
  portalFeedbackClassName,
  portalPanelClassName,
  PortalIcon,
  PortalMeta,
} from "../../../components/portal-ui";
import { getVisibleOpportunity } from "../../../server/opportunities/operations";

export const metadata = { title: "Detalle de oportunidad" };

/**
 * Next.js ejecuta este Server Component en la ruta de detalle. Usa getVisibleOpportunity y
 * llama a notFound si la oportunidad no está disponible.
 * @param props.params Promesa con el ID o slug de la oportunidad.
 * @param props.searchParams Promesa con el resultado de la acción de marcador.
 * @returns Detalle con descripción, solicitud y marcador, o la vista 404 de Next.js.
 */
export default async function OpportunityDetailPage({ params, searchParams }) {
  const [{ id }, { status }] = await Promise.all([params, searchParams]);
  const opportunity = await getVisibleOpportunity(id);
  if (!opportunity) notFound();

  const message = opportunityStatusMessages.get(status);
  const typeLabel = opportunityTypeLabels[opportunity.type];

  return (
    <main className={pageClassName}>
      <BackLink href="/opportunities">Volver a oportunidades</BackLink>
      <PageHeading title={opportunity.title} description={opportunity.organization} />
      {message && <p className={portalFeedbackClassName} role="status">{message}</p>}

      <div className="grid min-w-0 items-start gap-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-6">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <PortalMeta icon={Briefcase01Icon}>{typeLabel}</PortalMeta>
            {opportunity.location && <PortalMeta icon={Location01Icon}>{opportunity.location}</PortalMeta>}
            {opportunity.deadlineAt && (
              <PortalMeta icon={Calendar03Icon}>Hasta el <OpportunityDate date={opportunity.deadlineAt} /></PortalMeta>
            )}
          </div>

          {opportunity.imageUrl && opportunity.imageAlt && (
            <figure className="overflow-hidden rounded-lg border border-brand-line">
              <img
                src={opportunity.imageUrl}
                alt={opportunity.imageAlt}
                className="max-h-80 w-full object-cover"
              />
            </figure>
          )}

          <section className="grid gap-3" aria-labelledby="opportunity-details">
            <h2 id="opportunity-details" className="border-b border-brand-line pb-2.5">Descripción</h2>
            <p className="whitespace-pre-line [overflow-wrap:anywhere]">{opportunity.description}</p>
            {opportunity.researchLead && <p><strong>Responsable</strong> · {opportunity.researchLead}</p>}
            {opportunity.publishedAt && (
              <p><strong>Publicada</strong> · <OpportunityDate date={opportunity.publishedAt} /></p>
            )}
          </section>

          {opportunity.requirements && (
            <section className="grid gap-3" aria-labelledby="opportunity-requirements">
              <h2 id="opportunity-requirements" className="border-b border-brand-line pb-2.5">Requisitos</h2>
              <p className="whitespace-pre-line [overflow-wrap:anywhere]">{opportunity.requirements}</p>
            </section>
          )}

          {opportunity.infoUrl && (
            <section className="grid gap-3" aria-labelledby="opportunity-info">
              <h2 id="opportunity-info" className="border-b border-brand-line pb-2.5">Más información</h2>
              <a
                className={secondaryButtonClass}
                href={opportunity.infoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Consultar información externa
              </a>
            </section>
          )}
        </div>

        <section className={portalPanelClassName + " bg-brand-panel"} aria-labelledby="opportunity-apply">
          <h2 id="opportunity-apply" className="flex items-center gap-2.5 border-b border-brand-line pb-2.5">
            <PortalIcon icon={Note01Icon} className="text-brand-primary" size={22} />
            Cómo solicitar
          </h2>
          {(opportunity.workModality || opportunity.deadlineAt) && (
            <dl className="grid gap-3">
              {opportunity.workModality && (
                <div className="border-b border-brand-line pb-2">
                  <dt className="font-bold">Modalidad</dt>
                  <dd className="[overflow-wrap:anywhere]">{opportunity.workModality}</dd>
                </div>
              )}
              {opportunity.deadlineAt && (
                <div className="border-b border-brand-line pb-2">
                  <dt className="font-bold">Fecha límite</dt>
                  <dd><OpportunityDate date={opportunity.deadlineAt} /></dd>
                </div>
              )}
            </dl>
          )}
          <p>La solicitud se gestiona fuera de Comunidad Ad Astra. Guardar un marcador no envía ninguna candidatura.</p>
          <div className="flex flex-wrap items-center gap-3">
            {opportunity.applicationUrl && (
              <a
                className={primaryButtonClass}
                href={opportunity.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Solicitar en sitio externo
              </a>
            )}
            {opportunity.contactEmail && (
              <a
                className={(opportunity.applicationUrl ? secondaryButtonClass : primaryButtonClass) + " [overflow-wrap:anywhere]"}
                href={"mailto:" + opportunity.contactEmail}
              >
                Contactar por correo ({opportunity.contactEmail})
              </a>
            )}
            <OpportunityBookmark
              opportunity={opportunity}
              saved={opportunity.bookmarked}
              returnTo={"/opportunities/" + opportunity.id}
            />
          </div>
          <Link href="/bookmarks" className="justify-self-start">Ver mis marcadores</Link>
        </section>
      </div>
    </main>
  );
}
