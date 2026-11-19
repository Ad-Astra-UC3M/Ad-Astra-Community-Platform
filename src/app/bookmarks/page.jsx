import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { listBookmarks } from "../../demo/opportunities";
import { requireUser } from "../../demo/session";
import { removeOpportunityBookmark } from "../opportunities/actions";

export const metadata = { title: "Mis marcadores" };

const typeLabels = {
  internship: "Prácticas",
  research: "Investigación",
};

const statusMessages = new Map([
  ["removed", "Marcador retirado."],
  ["saved", "Oportunidad guardada en tus marcadores."],
]);

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

export default async function BookmarksPage({ searchParams }) {
  const user = await requireUser();
  const { status } = await searchParams;
  const bookmarks = listBookmarks(user.workspaceId, user.id);
  const message = typeof status === "string" ? statusMessages.get(status) : undefined;

  return (
    <main className="shell stack">
      <BackLink href="/opportunities">Volver a oportunidades</BackLink>

      <header className="stack">
        <h1>Mis marcadores</h1>
        <p className="lead">
          Oportunidades guardadas para consultarlas más adelante. Guardar un marcador no envía ninguna candidatura.
        </p>
      </header>

      {message && <p className="notice" role="status">{message}</p>}

      {bookmarks.length === 0 ? (
        <section className="panel stack">
          <p>Todavía no tienes oportunidades guardadas.</p>
          <div>
            <Link className="button" href="/opportunities">Explorar oportunidades</Link>
          </div>
        </section>
      ) : (
        bookmarks.map((bookmark) => (
          <article className="panel stack" key={bookmark.id}>
            {bookmark.status === "archived" ? (
              <>
                <header className="stack">
                  <p className="eyebrow">{typeLabels[bookmark.type]} · Cerrada</p>
                  <h2>{bookmark.title}</h2>
                  <p>{bookmark.organization}</p>
                </header>
                <p>Cerrada. Esta oportunidad ya no admite solicitudes.</p>
                <form action={removeOpportunityBookmark}>
                  <input type="hidden" name="opportunityId" value={bookmark.id} />
                  <input type="hidden" name="returnTo" value="/bookmarks" />
                  <button
                    className="button secondary"
                    type="submit"
                    aria-label={`Retirar marcador · ${bookmark.title}`}
                  >
                    Retirar marcador
                  </button>
                </form>
              </>
            ) : (
              <>
                <header className="stack">
                  <p className="eyebrow">{typeLabels[bookmark.type]}</p>
                  <h2>
                    <Link href={`/opportunities/${bookmark.id}`}>{bookmark.title}</Link>
                  </h2>
                  <p>
                    {[bookmark.organization, bookmark.location, bookmark.modality]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </header>
                {bookmark.deadline && (
                  <p>
                    Fecha límite:{" "}
                    <time dateTime={new Date(bookmark.deadline).toISOString()}>
                      {dateFormat.format(new Date(bookmark.deadline))}
                    </time>
                  </p>
                )}
                <div className="action-row">
                  <Link className="button" href={`/opportunities/${bookmark.id}`}>Ver detalle</Link>
                  <form action={removeOpportunityBookmark}>
                    <input type="hidden" name="opportunityId" value={bookmark.id} />
                    <input type="hidden" name="returnTo" value="/bookmarks" />
                    <button
                      className="button secondary"
                      type="submit"
                      aria-label={`Retirar marcador · ${bookmark.title}`}
                    >
                      Retirar marcador
                    </button>
                  </form>
                </div>
              </>
            )}
          </article>
        ))
      )}
    </main>
  );
}
