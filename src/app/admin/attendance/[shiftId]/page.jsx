import { notFound } from "next/navigation";
import { BackLink } from "../../../../components/back-link";
import {
  getShiftDetail,
  listActiveAccountsForDoor,
  listAttendanceAudit,
  listShiftAttendeesDetailed,
} from "../../../../server/repositories/admin";
import { requireCapability } from "../../access";
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

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";
const fieldClass = "grid min-w-0 gap-1.5 font-bold";
const inlineFieldClass = "grid min-w-0 flex-1 basis-56 gap-1.5 font-bold";
const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";
const noticeClass = "rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink empty:hidden";
const alertClass = "rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink";
const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";
const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

export default async function AttendancePage({ params, searchParams }) {
  await requireCapability("attendance_validation");
  const { shiftId } = await params;
  const resolvedSearch = await searchParams;
  const query = typeof resolvedSearch?.q === "string" ? resolvedSearch.q : "";
  const accountQuery = typeof resolvedSearch?.accountQuery === "string" ? resolvedSearch.accountQuery : "";
  const doorCode = typeof resolvedSearch?.door === "string" ? resolvedSearch.door : "";
  const manualCode = typeof resolvedSearch?.manual === "string" ? resolvedSearch.manual : "";

  const shift = await getShiftDetail(shiftId);
  if (!shift) notFound();

  const [allAttendees, queriedAttendees, doorAccounts, auditEntries] = await Promise.all([
    listShiftAttendeesDetailed(shiftId),
    query ? listShiftAttendeesDetailed(shiftId, query) : Promise.resolve(null),
    listActiveAccountsForDoor(shiftId, accountQuery),
    listAttendanceAudit(shiftId),
  ]);
  const filteredAttendees = queriedAttendees ?? allAttendees;

  const doorBanner = doorFeedback.get(doorCode);
  const manualBanner = manualFeedback.get(manualCode);
  const confirmedCount = allAttendees.filter((person) => person.status === "attended").length;

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/admin">Volver a turnos</BackLink>
      <header className="grid min-w-0 gap-4">
        <p className="text-[0.9rem] font-bold text-brand-primary">Control de asistencia · {shift.name}</p>
        <h1>{shift.activityTitle}</h1>
        <p>
          {dateTimeFormat.format(new Date(shift.startsAt))} – {dateTimeFormat.format(new Date(shift.endsAt))} ·{" "}
          {shift.capacity === null
            ? `${shift.reservedCount} plazas ocupadas (aforo ilimitado)`
            : `${shift.reservedCount}/${shift.capacity} plazas ocupadas (${shift.available} disponibles)`}
        </p>
      </header>

      {doorBanner && (
        <p
          className={doorBanner.kind === "alert" ? alertClass : noticeClass}
          role={doorBanner.kind === "alert" ? "alert" : undefined}
        >
          {doorBanner.text}
        </p>
      )}
      {manualBanner && (
        <p
          className={manualBanner.kind === "alert" ? alertClass : noticeClass}
          role={manualBanner.kind === "alert" ? "alert" : undefined}
        >
          {manualBanner.text}
        </p>
      )}

      <Scanner action={validateCard.bind(null, shiftId)} />

      <section className={panelClass} aria-label="Inscripción manual en puerta">
        <h2>Inscripción manual en puerta</h2>
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

        <form action={registerAtDoorAction} className="grid min-w-0 gap-4">
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

      <section className={panelClass} aria-label="Personas inscritas y confirmación o corrección manual">
        <h2>Personas inscritas</h2>
        <p>{confirmedCount} de {allAttendees.length} asistencias confirmadas</p>

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

        {filteredAttendees.length > 0 ? (
          <ul className="m-0 grid list-none gap-4 p-0">
            {filteredAttendees.map((person) => (
              <li className={panelClass} key={person.personId}>
                <p>
                  <strong>{person.name}</strong> · {person.status === "attended" ? "Asistido" : "Apuntado"}
                  {person.email ? ` (${person.email})` : ""}
                </p>
                {person.status === "booked" ? (
                  <form action={confirmManualAttendanceAction} className="grid min-w-0 gap-4">
                    <input type="hidden" name="shiftId" value={shiftId} />
                    <input type="hidden" name="personId" value={person.personId} />
                    <label className={fieldClass}>
                      Motivo de confirmación manual ({person.name})
                      <input
                        className={inputClass}
                        name="reason"
                        type="text"
                        required
                        maxLength={500}
                        placeholder="Ejemplo: Verificación manual por fallo de cámara"
                      />
                    </label>
                    <div>
                      <button type="submit" className={secondaryButtonClass}>
                        Confirmar asistencia manualmente
                      </button>
                    </div>
                  </form>
                ) : (
                  <form action={correctAttendanceAction} className="grid min-w-0 gap-4">
                    <input type="hidden" name="shiftId" value={shiftId} />
                    <input type="hidden" name="personId" value={person.personId} />
                    <input type="hidden" name="targetStatus" value="booked" />
                    <label className={fieldClass}>
                      Motivo de rectificación ({person.name})
                      <input
                        className={inputClass}
                        name="reason"
                        type="text"
                        required
                        maxLength={500}
                        placeholder="Ejemplo: Marcado por error, se devuelve a apuntado"
                      />
                    </label>
                    <div>
                      <button type="submit" className={secondaryButtonClass}>
                        Rectificar a apuntado
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>{query ? "No hay inscritos que coincidan con la búsqueda." : "Aún no hay reservas para este turno."}</p>
        )}
      </section>

      <section className={panelClass} aria-label="Historial de correcciones y altas en puerta">
        <h2>Historial de altas y correcciones</h2>
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
