/**
 * @file Página de App Router para `/activities`. Muestra el catálogo publicado para la persona conectada.
 */

import { ArrowRight01Icon, Calendar03Icon, Clock01Icon, Location01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { primaryButtonClass, secondaryButtonClass } from "../../components/form-styles";
import { PageHeading, pageClassName } from "../../components/page-layout";
import {
  ActivityDates,
  accentRibbonBaseClassName,
  PortalFigure,
  PortalIcon,
  PortalMeta,
  portalPanelClassName,
} from "../../components/portal-ui";
import AnimatedWordmark from "../../institutional/components/brand/AnimatedWordmark";
import TextSpanWrapper2 from "../../institutional/components/ui/TextSpanWrapper2";
import { listMyVisibleActivities } from "../../server/activities/portal";

const blueprintVisuals = [
  { imageUrl: "/brand/rocket-a4-concept-blueprint.png", imageAlt: "Rocket A4 · Visual conceptual" },
  { imageUrl: "/brand/sigma-concept-blueprint.png", imageAlt: "SIGMA · Visual conceptual" },
  { imageUrl: "/brand/jet-engine-concept-blueprint.png", imageAlt: "Jet Engine · Visual conceptual" },
];

/**
 * Selecciona la portada real de la actividad o rota un plano conceptual de Ad Astra cuando carece de foto.
 *
 * @param activity Actividad publicada devuelta por el repositorio.
 * @param fallbackIndex Posición dentro del listado para alternar ilustraciones conceptuales.
 * @returns Descriptor con imagen y pie para `PortalFigure`.
 */
function resolveActivityVisual(activity, fallbackIndex) {
  if (activity.coverImage) {
    return { image: activity.coverImage, caption: activity.coverImage.imageAlt };
  }
  const fallback = blueprintVisuals[fallbackIndex % blueprintVisuals.length];
  return { image: fallback, caption: fallback.imageAlt };
}

/**
 * Renderiza la tarjeta destacada o secundaria de una actividad en el catálogo `/activities`.
 *
 * @param props Propiedades de la tarjeta.
 * @param props.activity Actividad con turnos, ubicación e imagen opcional.
 * @param props.featured Indica si es el bloque principal de apertura del catálogo.
 * @param props.visualIndex Índice secuencial para rotar ilustraciones por defecto.
 * @returns Artículo visual de la actividad con enlace a su detalle y reserva.
 */
function ActivityListCard({ activity, featured = false, visualIndex = 0 }) {
  const singleShift = activity.shifts.length === 1;
  const visual = resolveActivityVisual(activity, visualIndex);

  return (
    <article
      className={
        "grid min-w-0 gap-5 " +
        (featured
          ? "items-center rounded-lg border border-brand-line bg-brand-panel/55 p-4 sm:p-6 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"
          : "content-start rounded-lg border border-brand-line bg-brand-surface p-4 sm:p-5")
      }
    >
      <PortalFigure image={visual.image} caption={visual.caption} eager={featured} />
      <div className="grid min-w-0 content-start gap-4">
        {activity.shifts.length > 0 && (
          <PortalMeta icon={Calendar03Icon}><ActivityDates shifts={activity.shifts} /></PortalMeta>
        )}
        {featured ? (
          <TextSpanWrapper2
            as="h2"
            className={accentRibbonBaseClassName + " px-4 py-2 text-[clamp(1.1rem,2vw,1.5rem)]"}
          >
            {activity.title}
          </TextSpanWrapper2>
        ) : (
          <h3 className="font-serif text-[1.35rem] leading-tight font-bold normal-case text-brand-ink">
            {activity.title}
          </h3>
        )}
        <p className="max-w-[65ch] whitespace-pre-line [overflow-wrap:anywhere]">{activity.description}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-brand-line/70 pt-3">
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
        description={
          <>
            Explora los talleres y encuentros de{" "}
            <AnimatedWordmark inline ariaLabel="Ad Astra" className="mx-0.5 h-[0.76em] align-[-0.05em]" />{" "}
            y elige un turno.
          </>
        }
      />
      {featured ? (
        <>
          <ActivityListCard activity={featured} featured visualIndex={0} />
          {remaining.length > 0 && (
            <section className="grid min-w-0 gap-4" aria-labelledby="more-activities-heading">
              <TextSpanWrapper2
                as="h2"
                id="more-activities-heading"
                className="border-b border-brand-line pb-2.5 text-xl"
              >
                Más actividades
              </TextSpanWrapper2>
              <div className="grid gap-6 md:grid-cols-2">
                {remaining.map((activity, index) => (
                  <ActivityListCard key={activity.id} activity={activity} visualIndex={index + 1} />
                ))}
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
