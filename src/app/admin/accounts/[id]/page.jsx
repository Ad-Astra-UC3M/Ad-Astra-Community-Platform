/**
 * @file Ruta dinámica `/admin/accounts/[id]`. Presenta la ficha de la cuenta y los formularios de
 * capacidades y estado para administración general.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "../../../../components/back-link";
import { secondaryButtonClass } from "../../../../components/form-styles";
import { PageHeading, pageClassName } from "../../../../components/page-layout";
import { portalAlertClassName, portalFeedbackClassName, portalPanelClassName } from "../../../../components/portal-ui";
import TextSpanWrapper2 from "../../../../institutional/components/ui/TextSpanWrapper2";
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

/**
 * Next.js ejecuta este Server Component y consulta getAdminAccount. Llama a notFound si el
 * perfil no está disponible.
 *
 * @param props - Propiedades de ruta suministradas por Next.js.
 * @param props.params - Promesa con el ID de cuenta que se consulta.
 * @param props.searchParams - Promesa con status y error que indican el resultado de un cambio.
 * @returns Ficha en JSX con sus datos, formularios y trazabilidad, o la vista 404 si no hay
 *   cuenta.
 */
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
    <main className={pageClassName}>
      <BackLink href="/admin/accounts">Volver a cuentas</BackLink>
      <PageHeading
        eyebrow={`Administración general · ${account.status === "active" ? "Cuenta activa" : "Cuenta desactivada"}`}
        title={account.name}
        description={`${account.email}${account.degree ? ` · ${account.degree}` : ""}${account.course ? ` (${account.course})` : ""}`}
      />

      {statusMessage && (
        <p className={portalFeedbackClassName + " empty:hidden"} role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className={portalAlertClassName} role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-lg border border-brand-line bg-brand-surface" aria-label="Capacidades administrativas">
          <div className="border-b border-brand-line bg-brand-soft/35 px-5 py-3.5 sm:px-6">
            <TextSpanWrapper2 as="h2" className="text-xl">
              Capacidades independientes
            </TextSpanWrapper2>
          </div>
          <div className="grid gap-4 p-5 sm:p-6">
            <p className="text-[0.95rem]">
              Cada capacidad habilita exclusivamente su módulo. La administración general nunca implica consulta de talento.
            </p>
            <ul className="m-0 grid list-none gap-3 p-0">
              {CAPABILITY_CODES.map((capability) => {
                const enabled = activeCapabilities.has(capability);
                const info = capabilityDetails[capability];
                return (
                  <li
                    className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-brand-line bg-brand-panel/50 p-4"
                    key={capability}
                  >
                    <div className="grid min-w-0 gap-1">
                      <p>
                        <strong>{info.label}</strong>{" "}
                        <span
                          className={
                            "ms-1 inline-block rounded-sm border px-2 py-0.5 text-xs font-bold " +
                            (enabled
                              ? "border-[#b79b30] bg-brand-accent text-brand-ink"
                              : "border-brand-line bg-brand-surface text-brand-ink")
                          }
                        >
                          {enabled ? "Activa" : "No concedida"}
                        </span>
                      </p>
                      <p className="text-sm">{info.note}</p>
                    </div>
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
          </div>
        </section>

        <div className="grid gap-6">
          <section className="overflow-hidden rounded-lg border border-brand-line bg-brand-surface" aria-label="Estado de la cuenta">
            <div className="border-b border-brand-line bg-brand-soft/35 px-5 py-3.5 sm:px-6">
              <TextSpanWrapper2 as="h2" className="text-xl">
                Estado y acceso
              </TextSpanWrapper2>
            </div>
            <div className="grid gap-4 p-5 sm:p-6">
              <p>
                Estado actual: <strong>{account.status === "active" ? "Activa" : "Desactivada"}</strong>. Desactivar una cuenta cierra inmediatamente todas sus sesiones e impide el inicio de sesión y la validación QR.
              </p>
              <form action={setAccountStatusAction}>
                <input type="hidden" name="accountId" value={account.id} />
                <input type="hidden" name="status" value={account.status === "active" ? "deactivated" : "active"} />
                <button type="submit" className={secondaryButtonClass}>
                  {account.status === "active" ? "Desactivar cuenta" : "Reactivar cuenta"}
                </button>
              </form>
            </div>
          </section>

          {account.deletionRequests.length > 0 && (
            <section className="overflow-hidden rounded-lg border border-brand-line bg-brand-surface" aria-label="Solicitudes de supresión asociadas">
              <div className="border-b border-brand-line bg-brand-soft/35 px-5 py-3.5 sm:px-6">
                <TextSpanWrapper2 as="h2" className="text-xl">
                  Solicitudes de supresión
                </TextSpanWrapper2>
              </div>
              <div className="p-5 sm:p-6">
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
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className={portalPanelClassName} aria-label="Historial de reservas y asistencias">
          <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
            {`Historial de reservas y asistencias (${account.reservations.length})`}
          </TextSpanWrapper2>
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

        <section className={portalPanelClassName} aria-label="Auditoría de permisos">
          <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
            Auditoría de capacidades
          </TextSpanWrapper2>
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
      </div>
    </main>
  );
}
