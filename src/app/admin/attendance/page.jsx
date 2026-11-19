import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { listShiftSummaries } from "../../../demo/admin";
import { requireCapability } from "../access";

export const metadata = { title: "Validación de asistencia" };

const dateTimeFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const statusLabels = {
  draft: "Borrador",
  published: "Publicada",
  archived: "Archivada",
};

export default async function AdminAttendanceIndexPage() {
  const organizer = await requireCapability("attendance_validation");
  const shifts = listShiftSummaries(organizer.workspaceId);

  return (
    <main className="shell stack">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="stack">
        <p className="eyebrow">Validación de asistencia</p>
        <h1>Turnos disponibles</h1>
        <p className="lead">
          Selecciona un turno para validar tarjetas QR, inscribir manualmente en puerta o registrar correcciones.
        </p>
      </header>

      {shifts.length === 0 ? (
        <section className="panel">
          <p>No hay turnos registrados en este momento.</p>
        </section>
      ) : (
        <ul className="stack">
          {shifts.map((shift) => (
            <li className="panel stack" key={shift.id}>
              <p className="eyebrow">{statusLabels[shift.activityStatus]}</p>
              <h2>{shift.activityTitle}</h2>
              <p>
                <strong>{shift.name}</strong> ·{" "}
                {dateTimeFormat.format(new Date(shift.startsAt))} – {dateTimeFormat.format(new Date(shift.endsAt))}
              </p>
              <p>
                {shift.reservedCount}/{shift.capacity} plazas ocupadas ({shift.available} disponibles) ·{" "}
                {shift.attendedCount} asistencias confirmadas
              </p>
              <div>
                <Link className="button" href={`/admin/attendance/${shift.id}`}>
                  Validar {shift.name}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
