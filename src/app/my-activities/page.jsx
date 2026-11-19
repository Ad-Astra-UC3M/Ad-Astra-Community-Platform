import Link from "next/link";
import { listReservations } from "../../demo/activities";
import { requireUser } from "../../demo/session";
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

export default async function MyActivitiesPage({ searchParams }) {
  const user = await requireUser("/my-activities");
  const reservations = listReservations(user.workspaceId, user.id);
  const { status } = await searchParams;
  const message = typeof status === "string" ? messages.get(status) : undefined;

  return (
    <main className="shell stack">
      <h1>Mis actividades</h1>
      {message && <p className="notice" role="status">{message}</p>}
      {reservations.length === 0 ? (
        <section className="panel stack">
          <p>Todavía no tienes reservas.</p>
          <div><Link className="button" href="/activities">Explorar actividades</Link></div>
        </section>
      ) : (
        reservations.map((reservation) => (
          <article className="panel stack" key={reservation.shiftId}>
            <header>
              <h2><Link href={`/activities/${reservation.activityId}`}>{reservation.activityTitle}</Link></h2>
              <p>{reservation.shiftName} · {reservation.location}</p>
            </header>
            <ShiftSchedule startsAt={reservation.startsAt} endsAt={reservation.endsAt} />
            <p>{reservation.status === "attended" ? "Asistencia registrada" : "Reserva confirmada"}</p>
            {reservation.alternativeShifts.length > 0 && (
              <form action={changeActivityShift} className="stack">
                <input type="hidden" name="fromShiftId" value={reservation.shiftId} />
                <label className="field">
                  Cambiar a otro turno
                  <select name="toShiftId" defaultValue={reservation.alternativeShifts[0].id}>
                    {reservation.alternativeShifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name} ({shift.available} plazas libres)
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <button
                    className="button"
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
                  className="button secondary"
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
