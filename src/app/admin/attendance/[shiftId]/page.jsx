/**
 * @file Página de App Router para `/admin/attendance/[shiftId]`. Reúne el escáner, las inscripciones,
 * las operaciones manuales y el historial del turno.
 */

import { Ticket01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";
import { BackLink } from "../../../../components/back-link";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../../../components/form-styles";
import { PageHeading, pageClassName } from "../../../../components/page-layout";
import { portalAlertClassName, portalFeedbackClassName, portalMutedPanelClassName, portalPanelClassName, PortalIcon } from "../../../../components/portal-ui";
import TextSpanWrapper2 from "../../../../institutional/components/ui/TextSpanWrapper2";
import { getAttendanceShift } from "../../../../server/activities/attendance";
import {
  confirmManualAttendanceAction,
  correctAttendanceAction,
  registerAtDoorAction,
  validateCard,
} from "./actions";
import { Scanner } from "./scanner";

export const metadata = { title: "Control de asistencia" };

const dateTimeFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const doorFeedback = new Map([
  ["registered", { kind: "notice", text: "Inscripción en puerta registrada en estado «Apuntado». Confirma la asistencia en una acción separada." }],
  ["missing_reason", { kind: "alert", text: "Debes indicar un motivo para registrar la inscripción en puerta." }],
  ["missing_actor", { kind: "alert", text: "No se pudo identificar a la persona organizadora." }],
  ["missing_account", { kind: "alert", text: "Selecciona una cuenta verificada válida." }],
  ["account_deactivated", { kind: "alert", text: "No se puede inscribir una cuenta desactivada." }],
  ["missing_shift", { kind: "alert", text: "No se encontró el turno seleccionado." }],
  ["activity_not_published", { kind: "alert", text: "La actividad no está publicada y no admite nuevas inscripciones." }],
  ["shift_ended", { kind: "alert", text: "El turno ya ha terminado y no admite inscripciones en puerta." }],
  ["duplicate", { kind: "alert", text: "Esta cuenta ya tiene una reserva en este turno." }],
  ["full", { kind: "alert", text: "No quedan plazas disponibles en este turno." }],
]);

const manualFeedback = new Map([
  ["confirmed", { kind: "notice", text: "Asistencia confirmada manualmente y registrada en auditoría." }],
  ["reverted", { kind: "notice", text: "Asistencia rectificada a «Apuntado» conservando la plaza." }],
  ["missing_reason", { kind: "alert", text: "Debes indicar un motivo obligatorio para esta operación." }],
  ["missing_actor", { kind: "alert", text: "No se pudo identificar a la persona organizadora." }],
  ["invalid_status", { kind: "alert", text: "El estado de asistencia indicado no es válido." }],
  ["missing_reservation", { kind: "alert", text: "No se encontró la reserva indicada en este turno." }],
  ["account_deactivated", { kind: "alert", text: "La cuenta está desactivada y no se puede confirmar su asistencia." }],
  ["already_attended", { kind: "alert", text: "La asistencia ya estaba confirmada." }],
  ["unchanged", { kind: "alert", text: "El estado seleccionado coincide con el actual." }],
]);

const auditEventLabels = {
  door_registered: "Alta en puerta",
  attendance_qr: "Validación QR",
  attendance_manual: "Confirmación manual",
  attendance_corrected: "Rectificación manual",
  cancelled: "Cancelación",
  changed: "Cambio de turno",
};

const statusLabels = {
  booked: "Apuntado",
  attended: "Asistido",
};

/**
 * Prepara el texto de estado que `AttendancePage` añade a cada entrada del historial.
 * @param entry Evento de participación, con su tipo y estados anterior y nuevo cuando estén
 * registrados.
 * @returns El resumen de la transición o del estado deducido del evento, o una cadena vacía.
 */
function formatAuditStatusSummary(entry) {
  if (entry.previousStatus && entry.newStatus) {
    return ` (${statusLabels[entry.previousStatus]} → ${statusLabels[entry.newStatus]})`;
  }
  if (entry.eventType === "door_registered") {
    return ` (${statusLabels.booked})`;
  }
  if (entry.eventType === "attendance_qr" || entry.eventType === "attendance_manual") {
    return ` (${statusLabels.attended})`;
  }
  return "";
}

const fieldClass = "grid min-w-0 gap-1.5 font-bold";
const inlineFieldClass = "grid min-w-0 flex-1 basis-56 gap-1.5 font-bold";

/**
 * Next.js llama a esta página de servidor. Consulta `getAttendanceShift`, llama a `notFound` si falta
 * el turno y vincula `validateCard` al turno antes de pasarla al escáner cliente.
 * @param props Propiedades de la ruta que proporciona Next.js.
 * @param props.params Promesa que contiene el identificador `shiftId` del turno.
 * @param props.searchParams Promesa con `q` y `accountQuery` para las búsquedas y `door` y `manual`
 * para los avisos.
 * @returns Los controles de asistencia, los inscritos, las cuentas candidatas y la auditoría del turno.
 */
export default async function AttendancePage({ params, searchParams }) {
  const { shiftId } = await params;
  const resolvedSearch = await searchParams;
  const query = typeof resolvedSearch?.q === "string" ? resolvedSearch.q : "";
  const accountQuery = typeof resolvedSearch?.accountQuery === "string" ? resolvedSearch.accountQuery : "";
  const doorCode = typeof resolvedSearch?.door === "string" ? resolvedSearch.door : "";
  const manualCode = typeof resolvedSearch?.manual === "string" ? resolvedSearch.manual : "";

  const detail = await getAttendanceShift(shiftId, query, accountQuery);
  if (!detail) notFound();
  const { shift, attendees, doorAccounts, auditEntries } = detail;

  const doorBanner = doorFeedback.get(doorCode);
  const manualBanner = manualFeedback.get(manualCode);
  const occupationSummary =
    shift.capacity === null
      ? `${shift.reservedCount} plazas · aforo ilimitado · ${shift.attendedCount} asistencias`
      : `${shift.reservedCount}/${shift.capacity} plazas · ${shift.available} disponibles · ${shift.attendedCount} asistencias`;

  return (
    <main className={pageClassName}>
      <BackLink href="/admin">Volver a turnos</BackLink>
      <PageHeading
        eyebrow={`Control de asistencia · ${shift.name}`}
        title={shift.activityTitle}
        description={`${dateTimeFormat.format(new Date(shift.startsAt))} – ${dateTimeFormat.format(new Date(shift.endsAt))}`}
        actions={
          <p className="rounded-md border border-brand-line bg-brand-soft/45 px-4 py-2 text-sm font-bold text-brand-ink">
            {occupationSummary}
          </p>
        }
      />

      {doorBanner && (
        <p
          className={doorBanner.kind === "alert" ? portalAlertClassName : portalFeedbackClassName}
          role={doorBanner.kind === "alert" ? "alert" : undefined}
        >
          {doorBanner.text}
        </p>
      )}
      {manualBanner && (
        <p
          className={manualBanner.kind === "alert" ? portalAlertClassName : portalFeedbackClassName}
          role={manualBanner.kind === "alert" ? "alert" : undefined}
        >
          {manualBanner.text}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Scanner action={validateCard.bind(null, shiftId)} />

        <section className={portalPanelClassName} aria-label="Inscripción manual en puerta">
          <h2 className="flex items-center gap-2 border-b border-brand-line pb-2.5">
            <PortalIcon icon={Ticket01Icon} size={20} className="text-brand-primary" />
            <TextSpanWrapper2 as="span" className="min-w-0">
              Inscripción manual en puerta
            </TextSpanWrapper2>
          </h2>
          <p>
            Da de alta a una cuenta activa si quedan plazas y el turno no ha finalizado. El alta deja la reserva en estado{" "}
            <strong>Apuntado</strong>; la asistencia se confirma en una acción separada.
          </p>

          <form method="get" className="flex flex-wrap items-end gap-3">
            {query && <input type="hidden" name="q" value={query} />}
            <label className={inlineFieldClass}>
              Filtrar cuentas activas
              <input
                className={inputClass}
                name="accountQuery"
                type="search"
                defaultValue={accountQuery}
                placeholder="Nombre, correo o titulación"
              />
            </label>
            <button type="submit" className={secondaryButtonClass}>Buscar cuenta</button>
          </form>

          <form action={registerAtDoorAction} className="grid min-w-0 gap-4 border-t border-brand-line pt-4">
            <input type="hidden" name="shiftId" value={shiftId} />
            <label className={fieldClass}>
              Cuenta activa a inscribir
              <select className={inputClass} name="targetAccountId" required defaultValue="">
                <option value="" disabled>Selecciona una cuenta activa</option>
                {doorAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.email}){account.alreadyInShift ? " — ya inscrita en este turno" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className={fieldClass}>
              Motivo del alta en puerta
              <input
                className={inputClass}
                name="reason"
                type="text"
                required
                maxLength={500}
                placeholder="Ejemplo: Alta presencial en puerta con plaza libre"
              />
            </label>
            <div>
              <button type="submit" className={primaryButtonClass}>Inscribir en puerta</button>
            </div>
          </form>
        </section>
      </div>

      <section className="grid min-w-0 gap-4" aria-label="Personas inscritas y confirmación o corrección manual">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-brand-line pb-2.5">
          <h2 className="flex items-center gap-2">
            <PortalIcon icon={UserGroupIcon} size={20} className="text-brand-primary" />
            <TextSpanWrapper2 as="span" className="min-w-0">
              Personas inscritas
            </TextSpanWrapper2>
          </h2>
          <p className="text-[0.95rem] font-bold">{shift.attendedCount} de {shift.reservedCount} asistencias confirmadas</p>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-3">
          {accountQuery && <input type="hidden" name="accountQuery" value={accountQuery} />}
          <label className={inlineFieldClass}>
            Buscar inscrito sin cámara
            <input
              className={inputClass}
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Nombre o correo del participante"
            />
          </label>
          <button type="submit" className={secondaryButtonClass}>Filtrar inscritos</button>
        </form>

        {attendees.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-brand-line bg-brand-surface">
            <div
              aria-hidden="true"
              className="hidden bg-brand-ink px-4 py-3 text-sm font-bold text-brand-surface md:grid md:grid-cols-[minmax(0,0.85fr)_auto_minmax(0,1.4fr)] md:gap-4"
            >
              <span>Persona</span>
              <span>Estado</span>
              <span>Motivo y acción manual</span>
            </div>
            <ul className="m-0 grid list-none p-0">
              {attendees.map((person) => (
                <li
                  className="grid gap-3 border-t border-brand-line p-4 first:border-t-0 even:bg-brand-panel md:grid-cols-[minmax(0,0.85fr)_auto_minmax(0,1.4fr)] md:items-center md:gap-4"
                  key={person.personId}
                >
                  <div className="grid gap-0.5 [overflow-wrap:anywhere]">
                    <strong>{person.name}</strong>
                    {person.email && <span className="text-sm">{person.email}</span>}
                  </div>
                  <div>
                    <span
                      className={
                        "inline-block rounded-sm border px-2.5 py-0.5 text-sm font-bold " +
                        (person.status === "attended"
                          ? "border-brand-line bg-brand-soft/45 text-brand-ink"
                          : "border-[#b79b30] bg-brand-accent text-brand-ink")
                      }
                    >
                      {person.status === "attended" ? "Asistido" : "Apuntado"}
                    </span>
                  </div>
                  {person.status === "booked" ? (
                    <form action={confirmManualAttendanceAction} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-3">
                      <input type="hidden" name="shiftId" value={shiftId} />
                      <input type="hidden" name="personId" value={person.personId} />
                      <label className={fieldClass}>
                        <span className="text-sm">Motivo de confirmación manual ({person.name})</span>
                        <input
                          className={inputClass}
                          name="reason"
                          type="text"
                          required
                          maxLength={500}
                          placeholder="Ejemplo: Verificación manual por fallo de cámara"
                        />
                      </label>
                      <button type="submit" className={secondaryButtonClass}>
                        Confirmar asistencia manualmente
                      </button>
                    </form>
                  ) : (
                    <form action={correctAttendanceAction} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-3">
                      <input type="hidden" name="shiftId" value={shiftId} />
                      <input type="hidden" name="personId" value={person.personId} />
                      <input type="hidden" name="targetStatus" value="booked" />
                      <label className={fieldClass}>
                        <span className="text-sm">Motivo de rectificación ({person.name})</span>
                        <input
                          className={inputClass}
                          name="reason"
                          type="text"
                          required
                          maxLength={500}
                          placeholder="Ejemplo: Marcado por error, se devuelve a apuntado"
                        />
                      </label>
                      <button type="submit" className={secondaryButtonClass}>
                        Rectificar a apuntado
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={portalPanelClassName}>
            {query ? "No hay inscritos que coincidan con la búsqueda." : "Aún no hay reservas para este turno."}
          </p>
        )}
      </section>

      <section className={portalMutedPanelClassName} aria-label="Historial de correcciones y altas en puerta">
        <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
          Historial de altas y correcciones
        </TextSpanWrapper2>
        {auditEntries.length > 0 ? (
          <ul className="grid list-disc gap-1.5 pl-6">
            {auditEntries.map((entry) => (
              <li key={entry.id}>
                <strong>{auditEventLabels[entry.eventType] ?? entry.eventType}</strong> · {entry.personName}
                {formatAuditStatusSummary(entry)}
                {entry.reason ? ` · Motivo: «${entry.reason}»` : ""} · Por {entry.actorName} el{" "}
                {dateTimeFormat.format(new Date(entry.createdAt))}
              </li>
            ))}
          </ul>
        ) : (
          <p>Todavía no se han registrado operaciones auditadas en este turno.</p>
        )}
      </section>
    </main>
  );
}
