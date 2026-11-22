/**
 * @file Ruta /opportunities. Lee el catálogo publicado y el estado de los marcadores de la sesión.
 * Al enviar un formulario, las Server Actions devuelven al catálogo con el filtro activo.
 */

import { Bookmark01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { secondaryButtonClass } from "../../components/form-styles";
import { OpportunityListing, opportunityStatusMessages } from "../../components/opportunity-listing";
import { PageHeading, pageClassName } from "../../components/page-layout";
import { portalFeedbackClassName, portalPanelClassName, PortalIcon } from "../../components/portal-ui";
import { listVisibleOpportunities } from "../../server/opportunities/operations";

export const metadata = { title: "Oportunidades" };

const filters = [
  { key: undefined, label: "Todas", href: "/opportunities" },
  { key: "internship", label: "Prácticas", href: "/opportunities?type=internship" },
  { key: "research", label: "Investigación", href: "/opportunities?type=research" },
];

/**
 * Next.js ejecuta este Server Component en el catálogo y consulta las oportunidades de la sesión.
 * @param props.searchParams Promesa con el tipo de oportunidad y el resultado de la acción de marcador.
 * @returns El catálogo con filtros y formularios para guardar o retirar marcadores.
 */
export default async function OpportunitiesPage({ searchParams }) {
  const { type, status } = await searchParams;
  const activeFilter = filters.find((filter) => filter.key === type) ?? filters[0];
  const opportunities = await listVisibleOpportunities(activeFilter.key);
  const message = opportunityStatusMessages.get(status);

  return (
    <main className={pageClassName}>
      <PageHeading
        title="Oportunidades"
        description="Descubre prácticas e investigación relacionadas con el sector aeroespacial."
        actions={
          <Link className={secondaryButtonClass} href="/bookmarks">
            <PortalIcon icon={Bookmark01Icon} size={16} />
            Mis marcadores
          </Link>
        }
      />
      {message && <p className={portalFeedbackClassName} role="status">{message}</p>}
      <div className="min-w-0">
        <nav className="flex flex-wrap items-center gap-x-5 border-b border-brand-line" aria-label="Filtrar oportunidades por tipo">
          {filters.map((filter) => {
            const active = activeFilter === filter;
            return (
              <Link
                key={filter.label}
                className={
                  "inline-flex min-h-12 items-center border-b-4 pt-1 no-underline hover:text-brand-primary " +
                  (active ? "border-brand-accent font-bold text-brand-ink" : "border-transparent text-brand-ink")
                }
                href={filter.href}
                aria-current={active ? "page" : undefined}
              >
                {filter.label}
              </Link>
            );
          })}
        </nav>
        {opportunities.length === 0 ? (
          <section className={portalPanelClassName + " mt-4"}>
            <p>
              {activeFilter.key
                ? "No hay oportunidades publicadas para este filtro en este momento."
                : "No hay oportunidades publicadas en este momento."}
            </p>
            {activeFilter.key && (
              <Link className={secondaryButtonClass} href="/opportunities">Ver todas las oportunidades</Link>
            )}
          </section>
        ) : (
          opportunities.map((opportunity) => (
            <OpportunityListing
              key={opportunity.id}
              opportunity={opportunity}
              saved={opportunity.bookmarked}
              returnTo={activeFilter.href}
            />
          ))
        )}
      </div>
    </main>
  );
}
