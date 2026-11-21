/**
 * @file Página de App Router para `/activities`. Renderiza en el servidor el catálogo de actividades
 * publicado para la persona conectada.
 */

import Link from "next/link";
import { listMyVisibleActivities } from "../../server/activities/portal";

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";

/**
 * Next.js llama a esta página para abrir el catálogo. `listMyVisibleActivities` comprueba la sesión y
 * carga las actividades publicadas.
 * @returns El catálogo con enlaces al detalle y un mensaje cuando no hay actividades.
 */
export default async function ActivitiesPage() {
  const activities = await listMyVisibleActivities();

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-primary md:text-[2.5rem]">
        Actividades
      </h1>
      {activities.length === 0 ? (
        <section className={panelClass}>
          <p>No hay actividades publicadas en este momento.</p>
        </section>
      ) : (
        activities.map((activity) => {
          const singleShift = activity.shifts.length === 1;
          return (
            <article className={panelClass} key={activity.id}>
              {activity.coverImage && (
                <img
                  src={activity.coverImage.imageUrl}
                  alt={activity.coverImage.imageAlt}
                  loading="lazy"
                  className="max-h-56 w-full rounded-[4px] object-cover"
                />
              )}
              <header className="grid gap-1">
                <h2 className="font-display text-[1.25rem] leading-[1.22] font-normal uppercase">
                  {activity.title}
                </h2>
                <p>
                  {activity.location}
                  {singleShift ? " · Sesión única" : ` · ${activity.shifts.length} turnos`}
                </p>
              </header>
              <p>{activity.description}</p>
              <div>
                <Link className={primaryButtonClass} href={`/activities/${activity.id}`}>
                  {singleShift ? "Ver actividad" : "Ver turnos"}
                </Link>
              </div>
            </article>
          );
        })
      )}
    </main>
  );
}
