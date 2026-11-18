import Link from "next/link";
import { listReservations } from "../../demo/activities";
import { requireUser } from "../../demo/session";
import { ShiftSchedule } from "../activities/shift-schedule";
import { cancelActivityReservation } from "./actions";

const messages = new Map([
  ["cancelled", "Has cancelado la reserva."],
  ["attended", "Tu asistencia ya está registrada."],
  ["closed", "El turno ya ha empezado. El plazo de cancelación ha terminado."],
  ["missing", "La reserva ya no está disponible."],
]);

export default async function MyActivitiesPage({
  searchParams,
}) {
  const user = await requireUser();
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
