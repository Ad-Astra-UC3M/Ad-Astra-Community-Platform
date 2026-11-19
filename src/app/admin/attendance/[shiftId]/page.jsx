import { notFound } from "next/navigation";
import { BackLink } from "../../../../components/back-link";
import {
  getShiftDetail,
  listActiveAccountsForDoor,
  listAttendanceAudit,
  listShiftAttendeesDetailed,
} from "../../../../demo/admin";
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
  ["missing_account", { kind: "alert", text: "Selecciona una cuenta verificada válida." }],
  ["account_deactivated", { kind: "alert", text: "No se puede inscribir una cuenta desactivada." }],
  ["activity_not_published", { kind: "alert", text: "La actividad no está publicada y no admite nuevas inscripciones." }],
  ["shift_ended", { kind: "alert", text: "El turno ya ha terminado y no admite inscripciones en puerta." }],
  ["duplicate", { kind: "alert", text: "Esta cuenta ya tiene una reserva en este turno." }],
  ["full", { kind: "alert", text: "No quedan plazas disponibles en este turno." }],
]);

const manualFeedback = new Map([
  ["confirmed", { kind: "notice", text: "Asistencia confirmada manualmente y registrada en auditoría." }],
  ["reverted", { kind: "notice", text: "Asistencia rectificada a «Apuntado» conservando la plaza." }],
  ["missing_reason", { kind: "alert", text: "Debes indicar un motivo obligatorio para esta operación." }],
  ["missing_reservation", { kind: "alert", text: "No se encontró la reserva indicada en este turno." }],
  ["account_deactivated", { kind: "alert", text: "La cuenta está desactivada y no se puede confirmar su asistencia." }],
  ["already_attended", { kind: "alert", text: "La asistencia ya estaba confirmada." }],
  ["unchanged", { kind: "alert", text: "El estado seleccionado coincide con el actual." }],
]);

const auditActionLabels = {
  door_registration: "Alta en puerta",
  manual_confirm: "Confirmación manual",
  correction: "Rectificación manual",
};

const statusLabels = {
  booked: "Apuntado",
  attended: "Asistido",
};

export default async function AttendancePage({ params, searchParams }) {
  const organizer = await requireCapability("attendance_validation");
  const { shiftId } = await params;
  const resolvedSearch = await searchParams;
  const query = typeof resolvedSearch?.q === "string" ? resolvedSearch.q : "";
  const accountQuery = typeof resolvedSearch?.accountQuery === "string" ? resolvedSearch.accountQuery : "";
  const doorCode = typeof resolvedSearch?.door === "string" ? resolvedSearch.door : "";
  const manualCode = typeof resolvedSearch?.manual === "string" ? resolvedSearch.manual : "";

  const shift = getShiftDetail(organizer.workspaceId, shiftId);
  if (!shift) notFound();

  const allAttendees = listShiftAttendeesDetailed(organizer.workspaceId, shiftId);
  const filteredAttendees = query
    ? listShiftAttendeesDetailed(organizer.workspaceId, shiftId, query)
    : allAttendees;
  const doorAccounts = listActiveAccountsForDoor(organizer.workspaceId, shiftId, accountQuery);
  const auditEntries = listAttendanceAudit(organizer.workspaceId, shiftId);

  const doorBanner = doorFeedback.get(doorCode);
  const manualBanner = manualFeedback.get(manualCode);
  const confirmedCount = allAttendees.filter((person) => person.status === "attended").length;

  return (
    <main className="shell stack">
      <BackLink href="/admin">Volver a turnos</BackLink>
      <header className="stack">
        <p className="eyebrow">Control de asistencia · {shift.name}</p>
        <h1>{shift.activityTitle}</h1>
        <p>
          {dateTimeFormat.format(new Date(shift.startsAt))} – {dateTimeFormat.format(new Date(shift.endsAt))} ·{" "}
          {shift.reservedCount}/{shift.capacity} plazas ocupadas ({shift.available} disponibles)
        </p>
      </header>

      {doorBanner && (
        <p className="notice" role={doorBanner.kind === "alert" ? "alert" : undefined}>
          {doorBanner.text}
        </p>
      )}
      {manualBanner && (
        <p className="notice" role={manualBanner.kind === "alert" ? "alert" : undefined}>
          {manualBanner.text}
        </p>
      )}

      <Scanner action={validateCard.bind(null, shiftId)} />

      <section className="panel stack" aria-label="Inscripción manual en puerta">
        <h2>Inscripción manual en puerta</h2>
        <p>
          Da de alta a una cuenta activa si quedan plazas y el turno no ha finalizado. El alta deja la reserva en estado{" "}
          <strong>Apuntado</strong>; la asistencia se confirma en una acción separada.
        </p>

        <form method="get" className="action-row">
          {query && <input type="hidden" name="q" value={query} />}
          <label className="field">
            Filtrar cuentas activas
            <input
              name="accountQuery"
              type="search"
              defaultValue={accountQuery}
              placeholder="Nombre, correo o titulación"
            />
          </label>
          <button type="submit" className="button secondary">Buscar cuenta</button>
        </form>

        <form action={registerAtDoorAction} className="stack">
          <input type="hidden" name="shiftId" value={shiftId} />
          <label className="field">
            Cuenta activa a inscribir
            <select name="targetAccountId" required defaultValue="">
              <option value="" disabled>Selecciona una cuenta activa</option>
              {doorAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.email}){account.alreadyInShift ? " — ya inscrita en este turno" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Motivo del alta en puerta
            <input
              name="reason"
              type="text"
              required
              maxLength={500}
              placeholder="Ejemplo: Alta presencial en puerta con plaza libre"
            />
          </label>
          <div>
            <button type="submit" className="button">Inscribir en puerta</button>
          </div>
        </form>
      </section>

      <section className="panel stack" aria-label="Personas inscritas y confirmación o corrección manual">
        <h2>Personas inscritas</h2>
        <p>{confirmedCount} de {allAttendees.length} asistencias confirmadas</p>

        <form method="get" className="action-row">
          {accountQuery && <input type="hidden" name="accountQuery" value={accountQuery} />}
          <label className="field">
            Buscar inscrito sin cámara
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Nombre o correo del participante"
            />
          </label>
          <button type="submit" className="button secondary">Filtrar inscritos</button>
        </form>

        {filteredAttendees.length > 0 ? (
          <ul className="stack">
            {filteredAttendees.map((person) => (
              <li className="panel stack" key={person.personId}>
                <p>
                  <strong>{person.name}</strong> · {person.status === "attended" ? "Asistido" : "Apuntado"}
                  {person.email ? ` (${person.email})` : ""}
                </p>
                {person.status === "booked" ? (
                  <form action={confirmManualAttendanceAction} className="stack">
                    <input type="hidden" name="shiftId" value={shiftId} />
                    <input type="hidden" name="personId" value={person.personId} />
                    <label className="field">
                      Motivo de confirmación manual ({person.name})
                      <input
                        name="reason"
                        type="text"
                        required
                        maxLength={500}
                        placeholder="Ejemplo: Verificación manual por fallo de cámara"
                      />
                    </label>
                    <div>
                      <button type="submit" className="button secondary">
                        Confirmar asistencia manualmente
                      </button>
                    </div>
                  </form>
                ) : (
                  <form action={correctAttendanceAction} className="stack">
                    <input type="hidden" name="shiftId" value={shiftId} />
                    <input type="hidden" name="personId" value={person.personId} />
                    <input type="hidden" name="targetStatus" value="booked" />
                    <label className="field">
                      Motivo de rectificación ({person.name})
                      <input
                        name="reason"
                        type="text"
                        required
                        maxLength={500}
                        placeholder="Ejemplo: Marcado por error, se devuelve a apuntado"
                      />
                    </label>
                    <div>
                      <button type="submit" className="button secondary">
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

      <section className="panel stack" aria-label="Historial de correcciones y altas en puerta">
        <h2>Historial de altas y correcciones</h2>
        {auditEntries.length > 0 ? (
          <ul>
            {auditEntries.map((entry) => (
              <li key={entry.id}>
                <strong>{auditActionLabels[entry.action]}</strong> · {entry.personName} (
                {entry.previousStatus ? `${statusLabels[entry.previousStatus]} → ` : ""}
                {statusLabels[entry.newStatus]}) · Motivo: «{entry.reason}» · Por {entry.actorName} el{" "}
                {dateTimeFormat.format(new Date(entry.createdAt))}
              </li>
            ))}
          </ul>
        ) : (
          <p>Todavía no se han registrado operaciones manuales en este turno.</p>
        )}
      </section>
    </main>
  );
}
