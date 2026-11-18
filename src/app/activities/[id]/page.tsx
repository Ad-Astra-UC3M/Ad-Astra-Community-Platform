import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "../../../components/back-link";
import { getActivity } from "../../../demo/activities";
import { requireUser } from "../../../demo/session";
import { ShiftSchedule } from "../shift-schedule";
import { reserveActivityShift } from "./actions";

const messages = new Map([
  ["reserved", "Tu plaza está reservada."],
  ["duplicate", "Ya tienes una reserva en este turno."],
  ["full", "El turno se ha completado."],
  ["closed", "El turno ya ha empezado."],
  ["missing", "El turno ya no está disponible."],
]);

type ActivityPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
};

export default async function ActivityPage({ params, searchParams }: ActivityPageProps) {
  const user = await requireUser();
  const [{ id }, { status }] = await Promise.all([params, searchParams]);
  const activity = getActivity(user.workspaceId, id, user.id);
  if (!activity) notFound();

  const message = typeof status === "string" ? messages.get(status) : undefined;
  const reserve = reserveActivityShift.bind(null, activity.id);
  const now = Date.now();

  return (
    <main className="shell stack">
      <BackLink href="/activities">Volver a actividades</BackLink>
      <header>
        <h1>{activity.title}</h1>
        <p>{activity.location}</p>
        <p>{activity.description}</p>
      </header>
      {message && <p className="notice" role="status">{message}</p>}
      <section className="stack" aria-labelledby="turnos">
        <h2 id="turnos">Turnos</h2>
        {activity.shifts.map((shift) => {
          const closed = shift.startsAt <= now;
          const bookable = !closed && shift.available > 0 && !shift.booking;
          return (
            <article className="panel stack" key={shift.id}>
              <h3>{shift.name}</h3>
              <ShiftSchedule startsAt={shift.startsAt} endsAt={shift.endsAt} />
              {closed ? (
                <p>Inscripción cerrada</p>
              ) : (
                <p>{shift.available === 0 ? "Completo" : `${shift.available} de ${shift.capacity} plazas libres`}</p>
              )}
              {shift.booking && (
                <div>
                  <p>{shift.booking === "attended" ? "Asistencia registrada" : "Tienes una plaza reservada"}</p>
                  <Link className="button secondary" href="/my-activities">Ver mis actividades</Link>
                </div>
              )}
              {bookable && (
                <form action={reserve}>
                  <input type="hidden" name="shiftId" value={shift.id} />
                  <button className="button" type="submit" aria-label={`Reservar plaza · ${shift.name}`}>
                    Reservar plaza
                  </button>
                </form>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
