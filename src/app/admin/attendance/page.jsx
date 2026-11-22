/**
 * @file Página de App Router para `/admin/attendance`. Presenta los turnos y conduce al control de
 * asistencia de cada uno.
 */

import Link from "next/link";
import { AdminTable } from "../admin-table";
import { BackLink } from "../../../components/back-link";
import { listShiftSummaries } from "../../../server/activities/attendance";

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

const panelClass =
  "grid min-w-0 gap-4 rounded-lg border border-brand-primary/40 bg-brand-surface p-5 md:p-6";
const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

/**
 * Next.js ejecuta la página de servidor. `listShiftSummaries` comprueba `attendance_validation` y carga
 * los turnos con datos de ocupación.
 * @returns Los turnos con sus conteos y enlaces al detalle o el estado vacío.
 */
export default async function AdminAttendanceIndexPage() {
  const shifts = await listShiftSummaries();

  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-12 md:pt-12">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="grid min-w-0 gap-3 border-b border-brand-primary/40 pb-6">
        <p className="text-[0.9rem] font-bold text-brand-primary">Validación de asistencia</p>
        <h1>Turnos disponibles</h1>
        <p className="max-w-[48ch] text-[1.2rem] leading-[1.55]">
          Selecciona un turno para validar tarjetas QR, inscribir manualmente en puerta o registrar correcciones.
        </p>
      </header>

      {shifts.length === 0 ? (
        <section className={panelClass}>
          <p>No hay turnos registrados en este momento.</p>
        </section>
      ) : (
        <AdminTable label="Turnos disponibles" headers={["Actividad y turno", "Fecha", "Estado", "Ocupación", "Acción"]}>
            {shifts.map((shift) => (
              <tr key={shift.id}>
                <td><strong>{shift.activityTitle}</strong><br />{shift.name}</td>
                <td>{dateTimeFormat.format(new Date(shift.startsAt))} – {dateTimeFormat.format(new Date(shift.endsAt))}</td>
                <td>{statusLabels[shift.activityStatus]}</td>
                <td>{shift.capacity === null ? `${shift.reservedCount} plazas ocupadas (aforo ilimitado)` : `${shift.reservedCount}/${shift.capacity} plazas ocupadas (${shift.available} disponibles)`} · {shift.attendedCount} asistencias confirmadas</td>
                <td><Link className={primaryButtonClass} href={`/admin/attendance/${shift.id}`}>Validar {shift.name}</Link></td>
              </tr>
            ))}
          </AdminTable>
      )}
    </main>
  );
}
