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

function ShiftCard({ shift, reserve, singleShift, now }) {
  const closed = shift.startsAt <= now;
  const bookable = !closed && shift.available > 0 && !shift.booking;

  return (
    <article className="panel stack">
      <h3>{shift.name}</h3>
      {singleShift && <p className="eyebrow">Turno único seleccionado automáticamente</p>}
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
}

export default async function ActivityPage({ params, searchParams }) {
  const [{ id }, { status }] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/activities/${encodeURIComponent(id)}`);
  const activity = getActivity(user.workspaceId, id, user.id);
  if (!activity) notFound();

  const message = typeof status === "string" ? messages.get(status) : undefined;
  const reserve = reserveActivityShift.bind(null, activity.id);
  const now = Date.now();
  const singleShift = activity.shifts.length === 1;

  return (
    <main className="shell stack">
      <BackLink href="/activities">Volver a actividades</BackLink>
      <header className="stack">
        <h1>{activity.title}</h1>
        <p>{activity.location}</p>
        <p>{activity.description}</p>
      </header>
      {activity.images.length > 0 && (
        <section className="stack" aria-label="Imágenes de la actividad">
          {activity.images.map((image, index) => (
            <figure key={image.position} className="panel">
              <img
                src={image.imageUrl}
                alt={image.imageAlt}
                loading={index === 0 ? "eager" : "lazy"}
                style={{ width: "100%", maxHeight: "20rem", objectFit: "cover", borderRadius: "4px" }}
              />
              <figcaption>{index === 0 ? `Portada · ${image.imageAlt}` : image.imageAlt}</figcaption>
            </figure>
          ))}
        </section>
      )}
      {message && <p className="notice" role="status">{message}</p>}
      <section className="stack" aria-labelledby="turnos">
        <h2 id="turnos">{singleShift ? "Inscripción" : "Turnos"}</h2>
        {activity.shifts.map((shift) => (
          <ShiftCard
            key={shift.id}
            shift={shift}
            reserve={reserve}
            singleShift={singleShift}
            now={now}
          />
        ))}
      </section>
    </main>
  );
}
