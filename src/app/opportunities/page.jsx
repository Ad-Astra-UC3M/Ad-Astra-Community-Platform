import Link from "next/link";
import { listOpportunities } from "../../demo/opportunities";
import { requireUser } from "../../demo/session";
import { removeOpportunityBookmark, saveOpportunityBookmark } from "./actions";

export const metadata = { title: "Oportunidades" };

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

const filters = [
  { key: undefined, label: "Todas", href: "/opportunities" },
  { key: "internship", label: "Prácticas", href: "/opportunities?type=internship" },
  { key: "research", label: "Investigación", href: "/opportunities?type=research" },
];

export default async function OpportunitiesPage({ searchParams }) {
  const { type, status } = await searchParams;
  const activeType = type === "internship" || type === "research" ? type : undefined;
  const returnTo = activeType ? `/opportunities?type=${activeType}` : "/opportunities";
  const user = await requireUser(returnTo);
  const opportunities = listOpportunities(user.workspaceId, user.id, activeType);
  const message = typeof status === "string" ? statusMessages.get(status) : undefined;

  return (
    <main className="shell stack">
      <header className="stack">
        <h1>Oportunidades</h1>
        <p className="lead">
          Prácticas aeroespaciales y líneas de investigación en la UC3M. Guardar un marcador no envía ninguna candidatura.
        </p>
        <div className="action-row">
          <nav className="action-row" aria-label="Filtrar oportunidades por tipo">
            {filters.map((filter) => {
              const active = activeType === filter.key;
              return (
                <Link
                  key={filter.label}
                  className={active ? "button" : "button secondary"}
                  href={filter.href}
                  aria-current={active ? "page" : undefined}
                >
                  {filter.label}
                </Link>
              );
            })}
          </nav>
          <Link className="button secondary" href="/bookmarks">Mis marcadores</Link>
        </div>
      </header>

      {message && <p className="notice" role="status">{message}</p>}

      {opportunities.length === 0 ? (
        <section className="panel stack">
          <p>No hay oportunidades publicadas para este filtro en este momento.</p>
          {activeType && (
            <div><Link className="button secondary" href="/opportunities">Ver todas las oportunidades</Link></div>
          )}
        </section>
      ) : (
        opportunities.map((opportunity) => (
          <article className="panel stack" key={opportunity.id}>
            <header className="stack">
              <p className="eyebrow">{typeLabels[opportunity.type]}</p>
              <h2>
                <Link href={`/opportunities/${opportunity.id}`}>{opportunity.title}</Link>
              </h2>
              <p>
                {[opportunity.organization, opportunity.location, opportunity.modality]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </header>
            <p>{opportunity.description}</p>
            {opportunity.deadline && (
              <p>
                Fecha límite:{" "}
                <time dateTime={new Date(opportunity.deadline).toISOString()}>
                  {dateFormat.format(new Date(opportunity.deadline))}
                </time>
              </p>
            )}
            <div className="action-row">
              <Link className="button" href={`/opportunities/${opportunity.id}`}>Ver detalle</Link>
              <form action={opportunity.bookmarked ? removeOpportunityBookmark : saveOpportunityBookmark}>
                <input type="hidden" name="opportunityId" value={opportunity.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button
                  className="button secondary"
                  type="submit"
                  aria-label={`${opportunity.bookmarked ? "Retirar marcador" : "Guardar marcador"} · ${opportunity.title}`}
                >
                  {opportunity.bookmarked ? "Retirar marcador" : "Guardar marcador"}
                </button>
              </form>
            </div>
          </article>
        ))
      )}
    </main>
  );
}
