/**
 * @file Componentes compartidos para listar oportunidades y gestionar sus marcadores sin alterar los
 * filtros activos ni el estado accesible.
 */

import { Briefcase01Icon, Calendar03Icon, Location01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { removeOpportunityBookmark, saveOpportunityBookmark } from "../app/opportunities/actions";
import { BookmarkButton } from "./bookmark-button";
import { secondaryButtonClass } from "./form-styles";
import { portalDateFormat, PortalIcon, PortalMeta } from "./portal-ui";

export const opportunityTypeLabels = {
  internship: "Prácticas",
  research: "Investigación",
};

export const opportunityStatusMessages = new Map([
  ["saved", "Oportunidad guardada en tus marcadores. Guardar un marcador no envía ninguna candidatura."],
  ["removed", "Marcador retirado."],
  ["missing", "La oportunidad ya no está disponible."],
]);

/**
 * Formatea una fecha límite o de publicación de oportunidad en horario de Madrid.
 * @param props Propiedades de fecha.
 * @param props.date Marca temporal ISO, cadena o instancia `Date`.
 * @returns Elemento `<time>` accesible en español.
 */
export function OpportunityDate({ date }) {
  return <time dateTime={new Date(date).toISOString()}>{portalDateFormat.format(new Date(date))}</time>;
}

/**
 * Enlaza el botón accesible de marcador con las Server Actions de oportunidades.
 * @param props Propiedades del marcador en catálogo, detalle o guardados.
 * @param props.opportunity Oportunidad con `id` y `title`.
 * @param props.saved Indica si la sesión ya tiene guardada la oportunidad.
 * @param props.returnTo Ruta de retorno tras alternar el marcador.
 * @returns Formulario de botón con estado `aria-pressed` gestionado en servidor.
 */
export function OpportunityBookmark({ opportunity, saved, returnTo }) {
  return (
    <BookmarkButton
      action={saved ? removeOpportunityBookmark : saveOpportunityBookmark}
      id={opportunity.id}
      title={opportunity.title}
      saved={saved}
      returnTo={returnTo}
    />
  );
}

/**
 * Renderiza una fila de catálogo o de marcador con icono temático, metadatos con Hugeicons y acciones
 * de detalle y guardado.
 * @param props Propiedades de la tarjeta de oportunidad.
 * @param props.opportunity Datos visibles de la oportunidad.
 * @param props.saved Indica si la oportunidad está marcada por la sesión actual.
 * @param props.returnTo URL relativa a preservar al actualizar marcadores.
 * @returns Artículo de oportunidad listo para listas `/opportunities` y `/bookmarks`.
 */
export function OpportunityListing({ opportunity, saved, returnTo }) {
  const archived = opportunity.status === "archived";
  const href = `/opportunities/${opportunity.id}`;

  return (
    <article className="relative grid min-w-0 gap-4 border-b border-brand-line py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-5">
      {saved && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 start-0 size-4 bg-brand-accent [clip-path:polygon(0_0,100%_0,0_100%)]"
        />
      )}
      <div
        aria-hidden="true"
        className="hidden size-12 shrink-0 place-items-center rounded-md border border-brand-line bg-brand-panel text-brand-primary sm:grid"
      >
        <PortalIcon icon={Briefcase01Icon} size={22} />
      </div>
      <div className="grid min-w-0 gap-1.5">
        <p className="w-fit rounded-sm border border-brand-line bg-brand-panel px-2.5 py-0.5 text-sm font-bold">
          {opportunityTypeLabels[opportunity.type]}{archived && " · Cerrada"}
        </p>
        <h2 className="font-serif text-[1.35rem] leading-tight font-bold normal-case">
          {archived ? opportunity.title : (
            <Link href={href} className="text-brand-ink no-underline hover:text-brand-primary hover:underline">
              {opportunity.title}
            </Link>
          )}
        </h2>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-1 [overflow-wrap:anywhere]">
          <span>{opportunity.organization}</span>
          {opportunity.location && <PortalMeta icon={Location01Icon}>{opportunity.location}</PortalMeta>}
          {opportunity.workModality && <span>{opportunity.workModality}</span>}
          {opportunity.deadlineAt && (
            <PortalMeta icon={Calendar03Icon}>Hasta el <OpportunityDate date={opportunity.deadlineAt} /></PortalMeta>
          )}
        </div>
        {archived && <p>Esta oportunidad ya no admite solicitudes.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        {!archived && <Link href={href} className={secondaryButtonClass}>Ver detalle</Link>}
        <OpportunityBookmark opportunity={opportunity} saved={saved} returnTo={returnTo} />
      </div>
    </article>
  );
}
