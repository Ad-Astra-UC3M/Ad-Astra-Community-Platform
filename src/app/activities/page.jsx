/**
 * @file Página de App Router para `/activities`. Muestra el catálogo publicado para la persona conectada.
 */

import { ArrowRight01Icon, Calendar03Icon, Clock01Icon, Location01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { primaryButtonClass, secondaryButtonClass } from "../../components/form-styles";
import { PageHeading, pageClassName } from "../../components/page-layout";
import { ActivityDates, PortalFigure, PortalIcon, PortalMeta, portalPanelClassName } from "../../components/portal-ui";
import { listMyVisibleActivities } from "../../server/activities/portal";

function ActivityListCard({ activity, featured = false }) {
  const singleShift = activity.shifts.length === 1;
  const Heading = featured ? "h2" : "h3";
  const cardClass = featured && activity.coverImage
    ? "items-start md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
    : "content-start";

  return (
    <article className={"grid min-w-0 gap-5 " + cardClass}>
      {activity.coverImage && <PortalFigure image={activity.coverImage} eager={featured} />}
      <div className={"grid min-w-0 content-start gap-4 " + (featured ? "md:py-3" : "")}>
        {activity.shifts.length > 0 && (
          <PortalMeta icon={Calendar03Icon}><ActivityDates shifts={activity.shifts} /></PortalMeta>
        )}
        <Heading className={featured
          ? "text-[clamp(1.15rem,2.2vw,1.6rem)]"
          : "font-serif text-[1.35rem] leading-tight font-bold normal-case"}
        >
          {activity.title}
        </Heading>
        <p className="max-w-[65ch] whitespace-pre-line [overflow-wrap:anywhere]">{activity.description}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <PortalMeta icon={Location01Icon}>{activity.location}</PortalMeta>
          <PortalMeta icon={Clock01Icon}>
            {singleShift ? "Sesión única" : activity.shifts.length + " turnos"}
          </PortalMeta>
        </div>
        <Link
          className={featured ? primaryButtonClass : secondaryButtonClass}
          href={"/activities/" + activity.id}
        >
          {featured && <PortalIcon icon={ArrowRight01Icon} size={16} />}
          {singleShift ? "Ver actividad" : "Ver turnos"}
        </Link>
      </div>
    </article>
  );
}

/**
 * Next.js llama a esta página para abrir el catálogo. `listMyVisibleActivities` comprueba la sesión
 * y carga las actividades publicadas. La primera con imagen funciona como portada del catálogo.
 * @returns Catálogo de actividades con enlaces al detalle y un mensaje cuando está vacío.
 */
export default async function ActivitiesPage() {
  const activities = await listMyVisibleActivities();
  const featured = activities.find((activity) => activity.coverImage) ?? activities[0];
  const remaining = activities.filter((activity) => activity.id !== featured?.id);

  return (
    <main className={pageClassName}>
      <PageHeading
        title="Actividades"
        description="Explora los talleres y encuentros de Ad Astra y elige un turno."
      />
      {featured ? (
        <>
          <ActivityListCard activity={featured} featured />
          {remaining.length > 0 && (
            <section className="grid min-w-0 gap-4" aria-labelledby="more-activities-heading">
              <h2 id="more-activities-heading" className="border-b border-brand-line pb-2.5">
                Más actividades
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                {remaining.map((activity) => <ActivityListCard key={activity.id} activity={activity} />)}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className={portalPanelClassName}>
          <p>No hay actividades publicadas en este momento.</p>
        </section>
      )}
    </main>
  );
}
