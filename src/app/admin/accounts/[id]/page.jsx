import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "../../../../components/back-link";
import { CAPABILITY_CODES } from "../../../../db/schema";
import { getAdminAccount } from "../../../../server/accounts/operations";
import { setAccountStatusAction, toggleAccountCapabilityAction } from "../actions";

export const metadata = { title: "Ficha de cuenta" };

const capabilityDetails = {
  general_admin: {
    label: "Administración general",
    note: "Cuentas, métricas, capacidades y solicitudes de supresión. No concede acceso al talento.",
  },
  content_editing: {
    label: "Edición de contenido",
    note: "Actividades, turnos y oportunidades.",
  },
  attendance_validation: {
    label: "Validación de asistencia",
    note: "Escáner QR, altas manuales en puerta y correcciones auditadas.",
  },
  talent_consultation: {
    label: "Consulta de talento",
    note: "Capacidad independiente para consultar perfiles voluntarios de talento y enlaces.",
  },
};

const dateTimeFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const statusMessages = new Map([
  ["capability_granted", "Capacidad concedida y registrada en la auditoría de permisos."],
  ["capability_revoked", "Capacidad revocada y registrada en la auditoría de permisos."],
  ["account_deactivated", "Cuenta desactivada. Se han revocado sus sesiones activas y bloqueado la validación QR."],
  ["account_active", "Cuenta reactivada."],
]);

const errorMessages = new Map([
  ["last_general_admin", "No se puede revocar la administración general ni desactivar la única cuenta activa con esta capacidad."],
  ["invalid_capability", "La capacidad seleccionada no es válida."],
  ["invalid_status", "El estado solicitado no es válido."],
  ["missing_profile", "No se encontró la cuenta indicada."],
  ["missing_actor", "No se pudo identificar al administrador responsable."],
]);

const deletionLabels = {
  pending: "Pendiente",
  in_review: "En revisión",
  resolved: "Resuelta",
};

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";
const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

export default async function AdminAccountDetailPage({ params, searchParams }) {
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const statusCode = typeof resolvedSearch?.status === "string" ? resolvedSearch.status : "";
  const errorCode = typeof resolvedSearch?.error === "string" ? resolvedSearch.error : "";
  const account = await getAdminAccount(id);
  if (!account) notFound();

  const statusMessage = statusMessages.get(statusCode);
  const errorMessage = errorMessages.get(errorCode);
  const activeCapabilities = new Set(account.capabilities);

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/admin/accounts">Volver a cuentas</BackLink>
      <header className="grid min-w-0 gap-4">
        <p className="text-[0.9rem] font-bold text-brand-primary">
          Administración general · {account.status === "active" ? "Cuenta activa" : "Cuenta desactivada"}
        </p>
        <h1>{account.name}</h1>
        <p>
          {account.email}
          {account.degree ? ` · ${account.degree}` : ""}
          {account.course ? ` (${account.course})` : ""}
        </p>
      </header>

      {statusMessage && (
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink empty:hidden" role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
          {errorMessage}
        </p>
      )}

      <section className={panelClass} aria-label="Estado de la cuenta">
        <h2>Estado y acceso</h2>
        <p>
          Estado actual: <strong>{account.status === "active" ? "Activa" : "Desactivada"}</strong>. Desactivar una
          cuenta cierra inmediatamente todas sus sesiones e impide el inicio de sesión y la validación QR.
        </p>
        <form action={setAccountStatusAction}>
          <input type="hidden" name="accountId" value={account.id} />
          <input type="hidden" name="status" value={account.status === "active" ? "deactivated" : "active"} />
          <button type="submit" className={secondaryButtonClass}>
            {account.status === "active" ? "Desactivar cuenta" : "Reactivar cuenta"}
          </button>
        </form>
      </section>

      <section className={panelClass} aria-label="Capacidades administrativas">
        <h2>Capacidades independientes</h2>
        <p>
          Cada capacidad habilita exclusivamente su módulo. La administración general nunca implica consulta de
          talento.
        </p>
        <ul className="m-0 grid list-none gap-4 p-0">
          {CAPABILITY_CODES.map((capability) => {
            const enabled = activeCapabilities.has(capability);
            const info = capabilityDetails[capability];
            return (
              <li className={panelClass} key={capability}>
                <p>
                  <strong>{info.label}</strong> · {enabled ? "Activa" : "No concedida"}
                </p>
                <p>{info.note}</p>
                <form action={toggleAccountCapabilityAction}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <input type="hidden" name="capability" value={capability} />
                  <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
                  <button type="submit" className={secondaryButtonClass}>
                    {enabled ? `Revocar ${info.label}` : `Conceder ${info.label}`}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={panelClass} aria-label="Historial de reservas y asistencias">
        <h2>Historial de reservas y asistencias ({account.reservations.length})</h2>
        {account.reservations.length > 0 ? (
          <ul className="grid list-disc gap-1.5 pl-6">
            {account.reservations.map((item) => (
              <li key={item.participationId}>
                <strong>{item.activityTitle}</strong> · {item.shiftName} ·{" "}
                {item.status === "attended" ? "Asistido" : "Apuntado"} (reservado el{" "}
                {dateTimeFormat.format(new Date(item.reservedAt))})
              </li>
            ))}
          </ul>
        ) : (
          <p>Esta cuenta no tiene reservas registradas.</p>
        )}
      </section>

      {account.deletionRequests.length > 0 && (
        <section className={panelClass} aria-label="Solicitudes de supresión asociadas">
          <h2>Solicitudes de supresión</h2>
          <ul className="grid list-disc gap-1.5 pl-6">
            {account.deletionRequests.map((req) => (
              <li key={req.id}>
                <Link
                  className="text-brand-primary underline underline-offset-[0.22em] hover:text-brand-ink"
                  href={`/admin/deletion-requests/${req.id}`}
                >
                  Solicitud {deletionLabels[req.status]} · creada el {dateTimeFormat.format(new Date(req.createdAt))}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={panelClass} aria-label="Auditoría de permisos">
        <h2>Auditoría de capacidades</h2>
        {account.capabilityAudit.length > 0 ? (
          <ul className="grid list-disc gap-1.5 pl-6">
            {account.capabilityAudit.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.action === "granted" ? "Concedida" : "Revocada"}</strong>:{" "}
                {capabilityDetails[entry.capability]?.label ?? entry.capability} · por {entry.actorName} el{" "}
                {dateTimeFormat.format(new Date(entry.createdAt))}
              </li>
            ))}
          </ul>
        ) : (
          <p>Sin cambios de capacidades registrados para esta cuenta.</p>
        )}
      </section>
    </main>
  );
}
