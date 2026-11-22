/**
 * @file Página de App Router para `/my-activities`. Muestra las reservas próximas y el historial de
 * la sesión, con cambios de turno y cancelaciones cuando el servidor los permite.
 */

import { Calendar03Icon, Clock01Icon, RepeatIcon, Tick01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../components/form-styles";
import { PageHeading, pageClassName } from "../../components/page-layout";
import { portalFeedbackClassName, portalPanelClassName, PortalIcon } from "../../components/portal-ui";
import { ReservationAgendaCard, ReservationHistoryRow } from "../../components/reservation-agenda";
import { listMyReservations } from "../../server/activities/portal";
import { cancelActivityReservation, changeActivityShift } from "./actions";

export const metadata = { title: "Mis actividades" };

const messages = new Map([
  ["cancelled", "Has cancelado la reserva."],
  ["changed", "Has cambiado de turno correctamente."],
  ["attended", "Tu asistencia ya está registrada."],
  ["closed", "El turno ya ha empezado. No se permiten cambios ni cancelaciones."],
  ["full", "El turno de destino se ha completado. Tu reserva original sigue vigente."],
  ["duplicate", "Ya tienes una reserva en ese turno."],
  ["same_shift", "Selecciona un turno distinto al actual."],
  ["different_activity", "Solo puedes cambiar entre turnos de la misma actividad."],
  ["missing", "La reserva o el turno ya no están disponibles."],
]);

const railClass =
  "relative grid gap-4 ps-5 before:absolute before:inset-y-0 before:start-[6px] before:w-px before:bg-brand-primary sm:ps-7 sm:before:start-[7px]";

const nodeClass =
  "relative min-w-0 before:absolute before:top-[3rem] before:start-[-14px] before:size-[13px] before:-translate-x-1/2 before:rounded-full before:border before:border-brand-primary sm:before:start-[-21px]";

/**
 * Renderiza los controles de la tarjeta. Las Server Actions reciben el identificador del turno
 * y vuelven a comprobar los permisos y el estado de la reserva.
 */
function ReservationActions({ reservation }) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-brand-line pt-4 sm:gap-x-5">
      {reservation.otherShifts.length > 0 && (
        <form action={changeActivityShift} className="flex max-w-full min-w-0 flex-wrap items-end gap-3 sm:gap-x-5">
          <input type="hidden" name="fromShiftId" value={reservation.shiftId} />
          <label className="grid max-w-full min-w-0 gap-1.5 font-bold">
            <span className="flex items-center gap-2">
              <PortalIcon icon={Clock01Icon} className="text-brand-primary" />
              Nuevo turno
            </span>
            <select
              name="toShiftId"
              defaultValue={reservation.otherShifts[0].id}
              className={inputClass + " sm:min-w-[16rem]"}
            >
              {reservation.otherShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.available === null
                    ? shift.name + " (aforo ilimitado)"
                    : shift.name + " (" + shift.available + " plazas libres)"}
                </option>
              ))}
            </select>
          </label>
          <button
            className={primaryButtonClass}
            type="submit"
            aria-label={"Cambiar turno · " + reservation.activityTitle}
          >
            <PortalIcon icon={RepeatIcon} size={16} />
            Cambiar turno
          </button>
        </form>
      )}
      {reservation.canCancel && (
        <form action={cancelActivityReservation}>
          <input type="hidden" name="shiftId" value={reservation.shiftId} />
          <button
            className={secondaryButtonClass}
            type="submit"
            aria-label={["Cancelar reserva", reservation.activityTitle, reservation.shiftName].join(" · ")}
          >
            Cancelar reserva
          </button>
        </form>
      )}
    </div>
  );
}

function TimelineHeading({ id, icon, children }) {
  return (
    <h2 id={id} className="flex items-center gap-3 text-[clamp(1rem,2.1vw,1.5rem)] sm:after:h-px sm:after:flex-1 sm:after:bg-brand-ink">
      <span className="inline-flex min-w-0 items-center gap-2.5 bg-brand-accent px-4 py-2 [clip-path:polygon(10px_0,100%_0,calc(100%_-_10px)_100%,0_100%)]">
        <PortalIcon icon={icon} size={22} />
        {children}
      </span>
    </h2>
  );
}

/**
 * Next.js ejecuta la página y `listMyReservations` carga las reservas de la sesión en orden de
 * inicio. Las reservas futuras que siguen abiertas al cambio se muestran primero y el historial
 * se ordena del turno más reciente al más antiguo.
 * @param props Propiedades de la página que proporciona Next.js.
 * @param props.searchParams Promesa con la consulta. Usa `status` para mostrar el resultado de la acción.
 * @returns Las dos líneas de tiempo con los controles disponibles y sus estados vacíos.
 */
export default async function MyActivitiesPage({ searchParams }) {
  const [reservations, { status }] = await Promise.all([listMyReservations(), searchParams]);
  const message = typeof status === "string" ? messages.get(status) : undefined;
  const upcoming = reservations.filter((reservation) => reservation.canCancel);
  const history = reservations.filter((reservation) => !reservation.canCancel).reverse();

  return (
    <main className={pageClassName}>
      <PageHeading
        title="Mis actividades"
        description="Consulta tus reservas, cambia de turno y revisa tu asistencia."
        actions={
          <Link className={secondaryButtonClass} href="/activities">
            <PortalIcon icon={Calendar03Icon} size={16} />
            Explorar actividades
          </Link>
        }
      />
      {message && <p className={portalFeedbackClassName} role="status">{message}</p>}

      <section aria-labelledby="upcoming-reservations-heading" className="grid min-w-0 gap-4">
        <TimelineHeading id="upcoming-reservations-heading" icon={Calendar03Icon}>
          Próximas reservas
        </TimelineHeading>
        {upcoming.length > 0 ? (
          <ol className={railClass} role="list">
            {upcoming.map((reservation) => (
              <li className={nodeClass + " before:bg-brand-accent"} key={reservation.participationId}>
                <ReservationAgendaCard reservation={reservation}>
                  <ReservationActions reservation={reservation} />
                </ReservationAgendaCard>
              </li>
            ))}
          </ol>
        ) : (
          <p className={portalPanelClassName}>No tienes próximas reservas.</p>
        )}
      </section>

      <section aria-labelledby="attendance-history-heading" className="grid min-w-0 gap-4">
        <TimelineHeading id="attendance-history-heading" icon={Tick01Icon}>
          Historial de asistencia
        </TimelineHeading>
        {history.length > 0 ? (
          <ol className={railClass + " gap-0"} role="list">
            {history.map((reservation) => (
              <li className={nodeClass + " border-brand-line not-last:border-b before:bg-brand-surface"} key={reservation.participationId}>
                <ReservationHistoryRow reservation={reservation} />
              </li>
            ))}
          </ol>
        ) : (
          <p className={portalPanelClassName}>Aún no tienes turnos en tu historial.</p>
        )}
      </section>
    </main>
  );
}
