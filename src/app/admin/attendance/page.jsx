/**
 * @file Página de App Router para `/admin/attendance`. Presenta los turnos y conduce al control de
 * asistencia de cada uno.
 */

import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { primaryButtonClass } from "../../../components/form-styles";
import { PageHeading, pageClassName } from "../../../components/page-layout";
import { portalPanelClassName } from "../../../components/portal-ui";
import { listShiftSummaries } from "../../../server/activities/attendance";
import { AdminTable } from "../admin-table";

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

/**
 * Next.js ejecuta la página de servidor. `listShiftSummaries` comprueba `attendance_validation` y carga
 * los turnos con datos de ocupación.
 * @returns Los turnos con sus conteos y enlaces al detalle o el estado vacío.
 */
export default async function AdminAttendanceIndexPage() {
  const shifts = await listShiftSummaries();

  return (
    <main className={pageClassName}>
      <BackLink href="/admin">Volver al panel</BackLink>
      <PageHeading
        eyebrow="Validación de asistencia"
        title="Turnos disponibles"
        description="Selecciona un turno para validar tarjetas QR, inscribir manualmente en puerta o registrar correcciones."
      />

      {shifts.length === 0 ? (
        <section className={portalPanelClassName}>
          <p>No hay turnos registrados en este momento.</p>
        </section>
      ) : (
        <AdminTable label="Turnos disponibles" headers={["Actividad y turno", "Fecha", "Estado", "Ocupación", "Acción"]}>
          {shifts.map((shift) => (
            <tr key={shift.id}>
              <td><strong>{shift.activityTitle}</strong><br />{shift.name}</td>
              <td>{dateTimeFormat.format(new Date(shift.startsAt))} – {dateTimeFormat.format(new Date(shift.endsAt))}</td>
              <td>
                <span className="inline-block rounded-sm border border-brand-line bg-brand-panel px-2.5 py-0.5 text-sm font-bold">
                  {statusLabels[shift.activityStatus]}
                </span>
              </td>
              <td>
                {shift.capacity === null
                  ? `${shift.reservedCount} plazas ocupadas (aforo ilimitado)`
                  : `${shift.reservedCount}/${shift.capacity} plazas ocupadas (${shift.available} disponibles)`}{" "}
                · {shift.attendedCount} asistencias confirmadas
              </td>
              <td>
                <Link className={primaryButtonClass} href={`/admin/attendance/${shift.id}`}>
                  Validar {shift.name}
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </main>
  );
}
