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

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink";

const inlineLinkClass =
  "text-brand-primary underline underline-offset-[0.22em] transition-colors hover:text-brand-ink";

export default async function OpportunitiesPage({ searchParams }) {
  const { type, status } = await searchParams;
  const activeType = type === "internship" || type === "research" ? type : undefined;
  const returnTo = activeType ? `/opportunities?type=${activeType}` : "/opportunities";
  const user = await requireUser(returnTo);
  const opportunities = listOpportunities(user.workspaceId, user.id, activeType);
  const message = typeof status === "string" ? statusMessages.get(status) : undefined;

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <header className="grid min-w-0 gap-4">
        <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-primary md:text-[2.5rem]">
          Oportunidades
        </h1>
        <p className="max-w-[48ch] text-[1.2rem] leading-relaxed">
          Prácticas aeroespaciales y líneas de investigación en la UC3M. Guardar un marcador no envía ninguna candidatura.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-wrap items-center gap-3" aria-label="Filtrar oportunidades por tipo">
            {filters.map((filter) => {
              const active = activeType === filter.key;
              return (
                <Link
                  key={filter.label}
                  className={active ? primaryButtonClass : secondaryButtonClass}
                  href={filter.href}
                  aria-current={active ? "page" : undefined}
                >
                  {filter.label}
                </Link>
              );
            })}
          </nav>
          <Link className={secondaryButtonClass} href="/bookmarks">Mis marcadores</Link>
        </div>
      </header>

      {message && (
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
          {message}
        </p>
      )}

      {opportunities.length === 0 ? (
        <section className={panelClass}>
          <p>No hay oportunidades publicadas para este filtro en este momento.</p>
          {activeType && (
            <div>
              <Link className={secondaryButtonClass} href="/opportunities">Ver todas las oportunidades</Link>
            </div>
          )}
        </section>
      ) : (
        opportunities.map((opportunity) => (
          <article className={panelClass} key={opportunity.id}>
            <header className="grid min-w-0 gap-2">
              <p className="text-[0.9rem] font-bold text-brand-primary">{typeLabels[opportunity.type]}</p>
              <h2 className="font-display text-[1.25rem] leading-[1.22] font-normal uppercase">
                <Link href={`/opportunities/${opportunity.id}`} className={inlineLinkClass}>
                  {opportunity.title}
                </Link>
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
            <div className="flex flex-wrap items-center gap-3">
              <Link className={primaryButtonClass} href={`/opportunities/${opportunity.id}`}>Ver detalle</Link>
              <form action={opportunity.bookmarked ? removeOpportunityBookmark : saveOpportunityBookmark}>
                <input type="hidden" name="opportunityId" value={opportunity.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button
                  className={secondaryButtonClass}
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
