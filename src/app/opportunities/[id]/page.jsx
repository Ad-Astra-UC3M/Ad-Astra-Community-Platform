import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "../../../components/back-link";
import { getOpportunity } from "../../../demo/opportunities";
import { requireUser } from "../../../demo/session";
import { removeOpportunityBookmark, saveOpportunityBookmark } from "../actions";

export const metadata = { title: "Detalle de oportunidad" };

const typeLabels = {
  internship: "Prácticas",
  research: "Investigación",
};

const statusMessages = new Map([
  ["saved", "Oportunidad guardada en tus marcadores. Guardar un marcador no envía ninguna candidatura."],
  ["removed", "Marcador retirado."],
  ["missing", "La oportunidad ya no está disponible."],
]);

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink";

const inlineLinkClass =
  "text-brand-primary underline underline-offset-[0.22em] transition-colors hover:text-brand-ink";

export default async function OpportunityDetailPage({ params, searchParams }) {
  const [{ id }, { status }] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/opportunities/${encodeURIComponent(id)}`);
  const opportunity = getOpportunity(user.workspaceId, id, user.id);
  if (!opportunity || opportunity.status !== "published") notFound();

  const message = typeof status === "string" ? statusMessages.get(status) : undefined;
  const returnTo = `/opportunities/${opportunity.id}`;

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/opportunities">Volver a oportunidades</BackLink>

      <header className="grid min-w-0 gap-3">
        <p className="text-[0.9rem] font-bold text-brand-primary">{typeLabels[opportunity.type]}</p>
        <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-primary md:text-[2.5rem]">
          {opportunity.title}
        </h1>
        <p>
          {[opportunity.organization, opportunity.location, opportunity.modality]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {message && (
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
          {message}
        </p>
      )}

      {opportunity.imageUrl && opportunity.imageAlt && (
        <figure className="m-0">
          <img
            src={opportunity.imageUrl}
            alt={opportunity.imageAlt}
            className="max-h-80 w-full rounded-[4px] object-cover"
          />
        </figure>
      )}

      <section className={panelClass} aria-labelledby="opportunity-details">
        <h2 id="opportunity-details" className="font-display text-[1.25rem] leading-[1.22] font-normal uppercase">
          Descripción
        </h2>
        <p>{opportunity.description}</p>
        {opportunity.requirements && (
          <>
            <h3 className="text-[1.2rem] leading-[1.3]">Requisitos</h3>
            <p>{opportunity.requirements}</p>
          </>
        )}
        {opportunity.lead && (
          <p><strong>Responsable:</strong> {opportunity.lead}</p>
        )}
        {opportunity.deadline && (
          <p>
            <strong>Fecha límite:</strong>{" "}
            <time dateTime={new Date(opportunity.deadline).toISOString()}>
              {dateFormat.format(new Date(opportunity.deadline))}
            </time>
          </p>
        )}
        {opportunity.publishedAt && (
          <p>
            <strong>Publicada:</strong>{" "}
            <time dateTime={new Date(opportunity.publishedAt).toISOString()}>
              {dateFormat.format(new Date(opportunity.publishedAt))}
            </time>
          </p>
        )}
      </section>

      {opportunity.infoUrl && (
        <section className={panelClass} aria-labelledby="opportunity-info">
          <h2 id="opportunity-info" className="font-display text-[1.25rem] leading-[1.22] font-normal uppercase">
            Más información
          </h2>
          <p>Enlace informativo independiente del canal de solicitud.</p>
          <div>
            <a
              className={secondaryButtonClass}
              href={opportunity.infoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar información externa
            </a>
          </div>
        </section>
      )}

      <section className={panelClass} aria-labelledby="opportunity-apply">
        <h2 id="opportunity-apply" className="font-display text-[1.25rem] leading-[1.22] font-normal uppercase">
          Solicitud externa
        </h2>
        <p>
          La solicitud se gestiona fuera de Comunidad Ad Astra. Guardar un marcador no envía ninguna candidatura.
        </p>
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
              className={opportunity.applicationUrl ? secondaryButtonClass : primaryButtonClass}
              href={`mailto:${opportunity.contactEmail}`}
            >
              Contactar por correo ({opportunity.contactEmail})
            </a>
          )}
          <form action={opportunity.bookmarked ? removeOpportunityBookmark : saveOpportunityBookmark}>
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className={secondaryButtonClass} type="submit">
              {opportunity.bookmarked ? "Retirar marcador" : "Guardar marcador"}
            </button>
          </form>
        </div>
        <div>
          <Link href="/bookmarks" className={inlineLinkClass}>Ver mis marcadores</Link>
        </div>
      </section>
    </main>
  );
}
