/**
 * @file Página de App Router para `/my-activities`. Renderiza en servidor las reservas de la sesión y
 * ofrece cambiarlas o cancelarlas.
 */

import Link from "next/link";
import { listMyReservations } from "../../server/activities/portal";
import { ShiftSchedule } from "../activities/shift-schedule";
import { cancelActivityReservation, changeActivityShift } from "./actions";

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

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink";

const selectClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";

/**
 * Next.js ejecuta la página y `listMyReservations` carga los datos de la persona conectada. Los
 * formularios envían sus campos a las Server Actions de cambio y cancelación.
 * @param props Propiedades de la página que proporciona Next.js.
 * @param props.searchParams Promesa con la consulta. Usa `status` para mostrar el resultado de la
 * acción.
 * @returns La lista de reservas, con las operaciones disponibles para cada una, o el estado vacío.
 */
export default async function MyActivitiesPage({ searchParams }) {
  const reservations = await listMyReservations();
  const { status } = await searchParams;
  const message = typeof status === "string" ? messages.get(status) : undefined;

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-primary md:text-[2.5rem]">
        Mis actividades
      </h1>
      {message && (
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
          {message}
        </p>
      )}
      {reservations.length === 0 ? (
        <section className={panelClass}>
          <p>Todavía no tienes reservas.</p>
          <div>
            <Link className={primaryButtonClass} href="/activities">Explorar actividades</Link>
          </div>
        </section>
      ) : (
        reservations.map((reservation) => (
          <article className={panelClass} key={reservation.participationId}>
            <header className="grid gap-1">
              <h2 className="font-display text-[1.25rem] leading-[1.22] font-normal uppercase">
                <Link
                  href={`/activities/${reservation.activityId}`}
                  className="text-brand-primary underline underline-offset-[0.22em] transition-colors hover:text-brand-ink"
                >
                  {reservation.activityTitle}
                </Link>
              </h2>
              <p>{reservation.shiftName} · {reservation.location}</p>
            </header>
            <ShiftSchedule startsAt={reservation.startsAt} endsAt={reservation.endsAt} />
            <p>{reservation.status === "attended" ? "Asistencia registrada" : "Reserva confirmada"}</p>
            {reservation.otherShifts.length > 0 && (
              <form action={changeActivityShift} className="grid min-w-0 gap-4">
                <input type="hidden" name="fromShiftId" value={reservation.shiftId} />
                <label className="grid min-w-0 gap-1.5 font-bold">
                  Cambiar a otro turno
                  <select
                    name="toShiftId"
                    defaultValue={reservation.otherShifts[0].id}
                    className={selectClass}
                  >
                    {reservation.otherShifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.available === null
                          ? `${shift.name} (aforo ilimitado)`
                          : `${shift.name} (${shift.available} plazas libres)`}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <button
                    className={primaryButtonClass}
                    type="submit"
                    aria-label={`Cambiar turno · ${reservation.activityTitle}`}
                  >
                    Cambiar turno
                  </button>
                </div>
              </form>
            )}
            {reservation.canCancel && (
              <form action={cancelActivityReservation}>
                <input type="hidden" name="shiftId" value={reservation.shiftId} />
                <button
                  className={secondaryButtonClass}
                  type="submit"
                  aria-label={`Cancelar reserva · ${reservation.activityTitle} · ${reservation.shiftName}`}
                >
                  Cancelar reserva
                </button>
              </form>
            )}
          </article>
        ))
      )}
    </main>
  );
}
