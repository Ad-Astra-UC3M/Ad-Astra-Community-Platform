import { Calendar03Icon, Location01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { removeOpportunityBookmark, saveOpportunityBookmark } from "../app/opportunities/actions";
import { BookmarkButton } from "./bookmark-button";
import { secondaryButtonClass } from "./form-styles";
import { portalDateFormat, PortalMeta } from "./portal-ui";

export const opportunityTypeLabels = {
  internship: "Prácticas",
  research: "Investigación",
};

export const opportunityStatusMessages = new Map([
  ["saved", "Oportunidad guardada en tus marcadores. Guardar un marcador no envía ninguna candidatura."],
  ["removed", "Marcador retirado."],
  ["missing", "La oportunidad ya no está disponible."],
]);

export function OpportunityDate({ date }) {
  return <time dateTime={new Date(date).toISOString()}>{portalDateFormat.format(new Date(date))}</time>;
}

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

export function OpportunityListing({ opportunity, saved, returnTo }) {
  const archived = opportunity.status === "archived";
  const href = `/opportunities/${opportunity.id}`;

  return (
    <article className="grid min-w-0 gap-3 border-b border-brand-line py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5">
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
