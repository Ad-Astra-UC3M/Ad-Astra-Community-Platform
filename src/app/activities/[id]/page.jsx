/**
 * @file Página de App Router para `/activities/[id]`. Muestra una actividad publicada y ofrece
 * reservar sus turnos con el aforo y el estado de la sesión.
 */

import { Calendar03Icon, Location01Icon, Tick01Icon, Ticket01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "../../../components/back-link";
import { primaryButtonClass, secondaryButtonClass } from "../../../components/form-styles";
import { PageHeading, pageClassName } from "../../../components/page-layout";
import {
  ActivityDates,
  accentRibbonBaseClassName,
  portalBlueprintPanelClassName,
  portalFeedbackClassName,
  PortalFigure,
  PortalIcon,
  PortalMeta,
} from "../../../components/portal-ui";
import AnimatedWordmark from "../../../institutional/components/brand/AnimatedWordmark";
import TextSpanWrapper2 from "../../../institutional/components/ui/TextSpanWrapper2";
import { getMyVisibleActivity } from "../../../server/activities/portal";
import { ShiftSchedule } from "../shift-schedule";
import { reserveActivityShift } from "./actions";

const messages = new Map([
  ["reserved", "Tu plaza está reservada."],
  ["duplicate", "Ya tienes una reserva en este turno."],
  ["full", "El turno se ha completado."],
  ["closed", "El turno ya ha empezado."],
  ["deactivated", "Tu cuenta está desactivada y no puede realizar reservas."],
  ["missing", "El turno ya no está disponible."],
]);

/**
 * Muestra horario, aforo y reserva propia de cada turno.
 * @param props.shift Turno con horario, plazas y estado de la reserva.
 * @param props.reserve Server Action vinculada a la actividad. El formulario añade shiftId.
 * @param props.singleShift Activa el aviso cuando la actividad tiene un solo turno.
 * @param props.now Hora de referencia en milisegundos para cerrar la reserva si el turno ya empezó.
 * @returns Ficha de turno enmarcada con su estado y acción de reserva.
 */
function ShiftCard({ shift, reserve, singleShift, now }) {
  const closed = new Date(shift.startsAt).getTime() <= now;
  const hasCapacity = shift.available === null || shift.available > 0;
  const bookable = !closed && hasCapacity && !shift.booking;
  const attendance = shift.booking === "attended";

  return (
    <article className="grid min-w-0 items-center gap-3 rounded-md border border-brand-line bg-brand-surface p-4">
      <div className="grid min-w-0 gap-2">
        <h3 className="inline-block w-fit bg-brand-soft/45 px-3 py-0.5 font-serif text-lg leading-tight font-bold text-brand-ink [clip-path:polygon(6px_0,100%_0,calc(100%-6px)_100%,0_100%)]">
          {shift.name}
        </h3>
        {singleShift && (
          <p className="text-sm font-bold text-brand-primary">
            Turno único seleccionado automáticamente
          </p>
        )}
        <ShiftSchedule startsAt={shift.startsAt} endsAt={shift.endsAt} />
        {shift.locationOverride && (
          <PortalMeta icon={Location01Icon}>Ubicación del turno: {shift.locationOverride}</PortalMeta>
        )}
        <PortalMeta icon={Ticket01Icon}>
          {closed ? "Inscripción cerrada"
            : shift.available === null || shift.capacity === null ? "Aforo ilimitado"
              : shift.available === 0 ? "Completo"
                : shift.available + " de " + shift.capacity + " plazas libres"}
        </PortalMeta>
        {shift.booking && (
          <p className="flex w-fit items-center gap-2 rounded-sm bg-brand-accent px-2.5 py-1 text-sm font-bold">
            <PortalIcon icon={Tick01Icon} size={16} />
            {attendance ? "Asistencia registrada" : "Tienes una plaza reservada"}
          </p>
        )}
      </div>
      {shift.booking && (
        <Link className={secondaryButtonClass} href="/my-activities">Ver mis actividades</Link>
      )}
      {bookable && (
        <form action={reserve}>
          <input type="hidden" name="shiftId" value={shift.id} />
          <button className={primaryButtonClass} type="submit" aria-label={"Reservar plaza · " + shift.name}>
            <PortalIcon icon={Ticket01Icon} size={16} />
            Reservar plaza
          </button>
        </form>
      )}
    </article>
  );
}

/**
 * Next.js ejecuta esta página en servidor. Carga getMyVisibleActivity, responde con notFound cuando
 * falta el detalle y enlaza reserveActivityShift a la actividad cargada.
 * @param props.params Promesa con el ID o slug de la actividad.
 * @param props.searchParams Promesa con el resultado de la reserva.
 * @returns Detalle con galería, descripción y turnos.
 */
export default async function ActivityPage({ params, searchParams }) {
  const [{ id }, { status }] = await Promise.all([params, searchParams]);
  const activity = await getMyVisibleActivity(id);
  if (!activity) notFound();

  const message = messages.get(status);
  const reserve = reserveActivityShift.bind(null, activity.id);
  const now = Date.now();
  const singleShift = activity.shifts.length === 1;

  return (
    <main className={pageClassName}>
      <BackLink href="/activities">Volver a actividades</BackLink>
      <PageHeading
        title={activity.title}
        description={(
          <>
            {activity.shifts.length > 0 && <><ActivityDates shifts={activity.shifts} /> · </>}
            {activity.location}
          </>
        )}
      />
      {message && <p className={portalFeedbackClassName} role="status">{message}</p>}

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-6">
          {activity.images.length > 0 ? (
            <section className="grid min-w-0 gap-3 sm:grid-cols-2" aria-label="Imágenes de la actividad">
              {activity.images.map((image, index) => (
                <PortalFigure
                  key={image.id}
                  image={image}
                  caption={index === 0 ? "Portada · " + image.imageAlt : image.imageAlt}
                  eager={index === 0}
                  className={index === 0 ? "sm:col-span-2" : ""}
                />
              ))}
            </section>
          ) : (
            <PortalFigure
              image={{
                imageUrl: "/brand/rocket-a4-concept-blueprint.png",
                imageAlt: "Representación conceptual aeroespacial del proyecto",
              }}
              caption={
                <>
                  <AnimatedWordmark inline ariaLabel="Ad Astra" className="me-1 h-[0.8em] align-[-0.05em]" />{" "}
                  UC3M · Visual técnico
                </>
              }
              eager
            />
          )}
          <section aria-labelledby="about-activity-heading" className="grid min-w-0 gap-3">
            <TextSpanWrapper2
              as="h2"
              id="about-activity-heading"
              className="border-b border-brand-line pb-2.5 text-xl"
            >
              Sobre la actividad
            </TextSpanWrapper2>
            <p className="whitespace-pre-line [overflow-wrap:anywhere]">{activity.description}</p>
          </section>
        </div>

        <section className={portalBlueprintPanelClassName + " gap-4"} aria-labelledby="turnos">
          <h2 id="turnos" className={accentRibbonBaseClassName + " w-full justify-start px-4 py-2 text-lg"}>
            <PortalIcon icon={Calendar03Icon} className="text-brand-ink" size={21} />
            <TextSpanWrapper2 as="span" className="min-w-0">
              {singleShift ? "Inscripción" : "Turnos disponibles"}
            </TextSpanWrapper2>
          </h2>
          {activity.shifts.length === 0 ? (
            <p className="rounded-md border border-brand-line bg-brand-surface p-4">
              Esta actividad todavía no tiene turnos publicados.
            </p>
          ) : (
            <div className="grid gap-3">
              {activity.shifts.map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  reserve={reserve}
                  singleShift={singleShift}
                  now={now}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
