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

export default async function OpportunityDetailPage({ params, searchParams }) {
  const user = await requireUser();
  const [{ id }, { status }] = await Promise.all([params, searchParams]);
  const opportunity = getOpportunity(user.workspaceId, id, user.id);
  if (!opportunity || opportunity.status !== "published") notFound();

  const message = typeof status === "string" ? statusMessages.get(status) : undefined;
  const returnTo = `/opportunities/${opportunity.id}`;

  return (
    <main className="shell stack">
      <BackLink href="/opportunities">Volver a oportunidades</BackLink>

      <header className="stack">
        <p className="eyebrow">{typeLabels[opportunity.type]}</p>
        <h1>{opportunity.title}</h1>
        <p>
          {[opportunity.organization, opportunity.location, opportunity.modality]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {message && <p className="notice" role="status">{message}</p>}

      {opportunity.imageUrl && opportunity.imageAlt && (
        <figure>
          <img src={opportunity.imageUrl} alt={opportunity.imageAlt} />
        </figure>
      )}

      <section className="panel stack" aria-labelledby="opportunity-details">
        <h2 id="opportunity-details">Descripción</h2>
        <p>{opportunity.description}</p>
        {opportunity.requirements && (
          <>
            <h3>Requisitos</h3>
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
        <section className="panel stack" aria-labelledby="opportunity-info">
          <h2 id="opportunity-info">Más información</h2>
          <p>Enlace informativo independiente del canal de solicitud.</p>
          <div>
            <a
              className="button secondary"
              href={opportunity.infoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar información externa
            </a>
          </div>
        </section>
      )}

      <section className="panel stack" aria-labelledby="opportunity-apply">
        <h2 id="opportunity-apply">Solicitud externa</h2>
        <p>
          La solicitud se gestiona fuera de Comunidad Ad Astra. Guardar un marcador no envía ninguna candidatura.
        </p>
        <div className="action-row">
          {opportunity.applicationUrl && (
            <a
              className="button"
              href={opportunity.applicationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Solicitar en sitio externo
            </a>
          )}
          {opportunity.contactEmail && (
            <a
              className={opportunity.applicationUrl ? "button secondary" : "button"}
              href={`mailto:${opportunity.contactEmail}`}
            >
              Contactar por correo ({opportunity.contactEmail})
            </a>
          )}
          <form action={opportunity.bookmarked ? removeOpportunityBookmark : saveOpportunityBookmark}>
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className="button secondary" type="submit">
              {opportunity.bookmarked ? "Retirar marcador" : "Guardar marcador"}
            </button>
          </form>
        </div>
        <div>
          <Link href="/bookmarks">Ver mis marcadores</Link>
        </div>
      </section>
    </main>
  );
}
