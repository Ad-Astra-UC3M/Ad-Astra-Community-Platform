import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { requireUser } from "../../server/auth/access";
import { listBookmarks } from "../../server/opportunities/repository";
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

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink";

const inlineLinkClass =
  "text-brand-primary underline underline-offset-[0.22em] transition-colors hover:text-brand-ink";

export default async function BookmarksPage({ searchParams }) {
  const user = await requireUser("/bookmarks");
  const { status } = await searchParams;
  const bookmarks = await listBookmarks(user.personId);
  const message = typeof status === "string" ? statusMessages.get(status) : undefined;

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/opportunities">Volver a oportunidades</BackLink>

      <header className="grid min-w-0 gap-4">
        <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-primary md:text-[2.5rem]">
          Mis marcadores
        </h1>
        <p className="max-w-[48ch] text-[1.2rem] leading-relaxed">
          Oportunidades guardadas para consultarlas más adelante. Guardar un marcador no envía ninguna candidatura.
        </p>
      </header>

      {message && (
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
          {message}
        </p>
      )}

      {bookmarks.length === 0 ? (
        <section className={panelClass}>
          <p>Todavía no tienes oportunidades guardadas.</p>
          <div>
            <Link className={primaryButtonClass} href="/opportunities">Explorar oportunidades</Link>
          </div>
        </section>
      ) : (
        bookmarks.map((bookmark) => (
          <article className={panelClass} key={bookmark.id}>
            {bookmark.status === "archived" ? (
              <>
                <header className="grid min-w-0 gap-2">
                  <p className="text-[0.9rem] font-bold text-brand-primary">
                    {typeLabels[bookmark.type]} · Cerrada
                  </p>
                  <h2 className="font-display text-[1.25rem] leading-[1.22] font-normal uppercase">
                    {bookmark.title}
                  </h2>
                  <p>{bookmark.organization}</p>
                </header>
                <p>Cerrada. Esta oportunidad ya no admite solicitudes.</p>
                <form action={removeOpportunityBookmark}>
                  <input type="hidden" name="opportunityId" value={bookmark.id} />
                  <input type="hidden" name="returnTo" value="/bookmarks" />
                  <button
                    className={secondaryButtonClass}
                    type="submit"
                    aria-label={`Retirar marcador · ${bookmark.title}`}
                  >
                    Retirar marcador
                  </button>
                </form>
              </>
            ) : (
              <>
                <header className="grid min-w-0 gap-2">
                  <p className="text-[0.9rem] font-bold text-brand-primary">
                    {typeLabels[bookmark.type]}
                  </p>
                  <h2 className="font-display text-[1.25rem] leading-[1.22] font-normal uppercase">
                    <Link href={`/opportunities/${bookmark.id}`} className={inlineLinkClass}>
                      {bookmark.title}
                    </Link>
                  </h2>
                  <p>
                    {[bookmark.organization, bookmark.location, bookmark.workModality]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </header>
                {bookmark.deadlineAt && (
                  <p>
                    Fecha límite:{" "}
                    <time dateTime={new Date(bookmark.deadlineAt).toISOString()}>
                      {dateFormat.format(new Date(bookmark.deadlineAt))}
                    </time>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Link className={primaryButtonClass} href={`/opportunities/${bookmark.id}`}>Ver detalle</Link>
                  <form action={removeOpportunityBookmark}>
                    <input type="hidden" name="opportunityId" value={bookmark.id} />
                    <input type="hidden" name="returnTo" value="/bookmarks" />
                    <button
                      className={secondaryButtonClass}
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
