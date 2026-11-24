/**
 * @file Ruta /bookmarks. Lee las oportunidades que ha guardado la persona autenticada, incluidas
 * las archivadas, y ofrece retirar el marcador.
 */

import { Briefcase01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { primaryButtonClass } from "../../components/form-styles";
import { OpportunityListing, opportunityStatusMessages } from "../../components/opportunity-listing";
import { PageHeading, pageClassName } from "../../components/page-layout";
import { portalFeedbackClassName, portalPanelClassName, PortalIcon } from "../../components/portal-ui";
import { listMyBookmarks } from "../../server/opportunities/operations";

export const metadata = { title: "Mis marcadores" };

/**
 * Next.js ejecuta este Server Component para leer listMyBookmarks y mostrar el resultado de
 * removeOpportunityBookmark.
 * @param props.searchParams Promesa con status para el mensaje tras retirar un marcador.
 * @returns Lista personal con entradas publicadas y archivadas, o su estado vacío.
 */
export default async function BookmarksPage({ searchParams }) {
  const [bookmarks, { status }] = await Promise.all([listMyBookmarks(), searchParams]);
  const message = opportunityStatusMessages.get(status);

  return (
    <main className={pageClassName}>
      <BackLink href="/opportunities">Volver a oportunidades</BackLink>
      <PageHeading
        title="Mis marcadores"
        description="Consulta las oportunidades que has guardado."
      />
      {message && <p className={portalFeedbackClassName} role="status">{message}</p>}
      {bookmarks.length === 0 ? (
        <section className={portalPanelClassName}>
          <h2>Todavía no tienes oportunidades guardadas.</h2>
          <Link className={primaryButtonClass} href="/opportunities">
            <PortalIcon icon={Briefcase01Icon} size={16} />
            Explorar oportunidades
          </Link>
        </section>
      ) : (
        <div>
          {bookmarks.map((bookmark) => (
            <OpportunityListing key={bookmark.id} opportunity={bookmark} saved returnTo="/bookmarks" />
          ))}
        </div>
      )}
    </main>
  );
}
