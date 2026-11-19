import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "../../../../components/back-link";
import { getAccountAdminDetail } from "../../../../demo/admin";
import { ALL_CAPABILITIES } from "../../../../demo/session-store";
import { requireCapability } from "../../access";
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

const deletionLabels = {
  pending: "Pendiente",
  in_review: "En revisión",
  resolved: "Resuelta",
};

export default async function AdminAccountDetailPage({ params, searchParams }) {
  const admin = await requireCapability("general_admin");
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const statusCode = typeof resolvedSearch?.status === "string" ? resolvedSearch.status : "";
  const account = getAccountAdminDetail(admin.workspaceId, id);
  if (!account) notFound();

  const statusMessage = statusMessages.get(statusCode);
  const activeCapabilities = new Set(account.capabilities);

  return (
    <main className="shell stack">
      <BackLink href="/admin/accounts">Volver a cuentas</BackLink>
      <header className="stack">
        <p className="eyebrow">
          Administración general · {account.status === "active" ? "Cuenta activa" : "Cuenta desactivada"}
        </p>
        <h1>{account.name}</h1>
        <p>
          {account.email}
          {account.degree ? ` · ${account.degree}` : ""}
          {account.course ? ` (${account.course})` : ""}
        </p>
      </header>

      {statusMessage && <p className="notice" role="status">{statusMessage}</p>}

      <section className="panel stack" aria-label="Estado de la cuenta">
        <h2>Estado y acceso</h2>
        <p>
          Estado actual: <strong>{account.status === "active" ? "Activa" : "Desactivada"}</strong>. Desactivar una
          cuenta cierra inmediatamente todas sus sesiones e impide el inicio de sesión y la validación QR.
        </p>
        <form action={setAccountStatusAction}>
          <input type="hidden" name="accountId" value={account.id} />
          <input type="hidden" name="status" value={account.status === "active" ? "deactivated" : "active"} />
          <button type="submit" className="button secondary">
            {account.status === "active" ? "Desactivar cuenta" : "Reactivar cuenta"}
          </button>
        </form>
      </section>

      <section className="panel stack" aria-label="Capacidades administrativas">
        <h2>Capacidades independientes</h2>
        <p>
          Cada capacidad habilita exclusivamente su módulo. La administración general nunca implica consulta de
          talento.
        </p>
        <ul className="stack">
          {ALL_CAPABILITIES.map((capability) => {
            const enabled = activeCapabilities.has(capability);
            const info = capabilityDetails[capability];
            return (
              <li className="panel stack" key={capability}>
                <p>
                  <strong>{info.label}</strong> · {enabled ? "Activa" : "No concedida"}
                </p>
                <p>{info.note}</p>
                <form action={toggleAccountCapabilityAction}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <input type="hidden" name="capability" value={capability} />
                  <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
                  <button type="submit" className="button secondary">
                    {enabled ? `Revocar ${info.label}` : `Conceder ${info.label}`}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel stack" aria-label="Historial de reservas y asistencias">
        <h2>Historial de reservas y asistencias ({account.reservations.length})</h2>
        {account.reservations.length > 0 ? (
          <ul>
            {account.reservations.map((item) => (
              <li key={item.shiftId}>
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
        <section className="panel stack" aria-label="Solicitudes de supresión asociadas">
          <h2>Solicitudes de supresión</h2>
          <ul>
            {account.deletionRequests.map((req) => (
              <li key={req.id}>
                <Link href={`/admin/deletion-requests/${req.id}`}>
                  Solicitud {deletionLabels[req.status]} · creada el {dateTimeFormat.format(new Date(req.createdAt))}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel stack" aria-label="Auditoría de permisos">
        <h2>Auditoría de capacidades</h2>
        {account.capabilityAudit.length > 0 ? (
          <ul>
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
