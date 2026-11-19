import Link from "next/link";
import { listShifts } from "../../demo/activities";
import { getAdminMetrics } from "../../demo/admin";
import { requireAdminAny } from "./access";

export const metadata = { title: "Panel de administración" };

const moduleCards = [
  {
    capability: "attendance_validation",
    href: "/admin/attendance",
    title: "Validación de asistencia",
    description: "Escanea tarjetas QR, inscribe en puerta con plaza disponible y corrige asistencias con auditoría.",
    cta: "Abrir control de asistencia",
  },
  {
    capability: "content_editing",
    href: "/admin/activities",
    title: "Edición de actividades",
    description: "Crea actividades con turnos e imágenes ordenadas, ajusta aforos y gestiona su publicación o archivo.",
    cta: "Gestionar actividades",
  },
  {
    capability: "content_editing",
    href: "/admin/opportunities",
    title: "Edición de oportunidades",
    description: "Publica, edita estados o archiva oportunidades de prácticas e investigación.",
    cta: "Gestionar oportunidades",
  },
  {
    capability: "general_admin",
    href: "/admin/accounts",
    title: "Cuentas y permisos",
    description: "Consulta cuentas registradas, gestiona capacidades independientes y activa o desactiva accesos.",
    cta: "Gestionar cuentas",
  },
  {
    capability: "general_admin",
    href: "/admin/deletion-requests",
    title: "Solicitudes de supresión",
    description: "Revisa y resuelve de forma motivada las solicitudes de supresión de cuenta.",
    cta: "Ver solicitudes",
  },
  {
    capability: "talent_consultation",
    href: "/admin/talent",
    title: "Consulta de talento",
    description: "Busca perfiles voluntarios por habilidades, herramientas o intereses y consulta sus enlaces.",
    cta: "Consultar talento",
  },
];

const capabilityLabels = {
  general_admin: "Administración general",
  content_editing: "Edición de contenido",
  attendance_validation: "Validación de asistencia",
  talent_consultation: "Consulta de talento",
};

const activityStatusLabels = {
  draft: "Borrador",
  published: "Publicada",
  archived: "Archivada",
};

export default async function AdminPage() {
  const user = await requireAdminAny();
  const capabilities = new Set(user.capabilities);
  const visibleModules = moduleCards.filter((card) => capabilities.has(card.capability));
  const metrics = capabilities.has("general_admin") ? getAdminMetrics(user.workspaceId) : null;
  const shifts = capabilities.has("attendance_validation") ? listShifts(user.workspaceId) : [];

  return (
    <main className="shell stack">
      <header className="stack">
        <p className="eyebrow">Organización</p>
        <h1>Panel administrativo</h1>
        <p className="lead">
          Accede únicamente a los módulos autorizados para tus capacidades activas:{" "}
          {user.capabilities.map((cap) => capabilityLabels[cap] ?? cap).join(", ")}.
        </p>
      </header>

      <section className="stack" aria-label="Módulos administrativos disponibles">
        <h2>Módulos habilitados</h2>
        <ul className="stack">
          {visibleModules.map((mod) => (
            <li className="panel stack" key={mod.href}>
              <h3>{mod.title}</h3>
              <p>{mod.description}</p>
              <div>
                <Link className="button" href={mod.href}>{mod.cta}</Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {metrics && (
        <section className="panel stack" aria-label="Resumen de métricas">
          <h2>Métricas de la comunidad</h2>
          <p>
            <strong>{metrics.totalAccounts}</strong> cuentas verificadas ({metrics.activeAccounts} activas,{" "}
            {metrics.deactivatedAccounts} desactivadas) ·{" "}
            <strong>{metrics.pendingDeletionRequests}</strong> solicitudes de supresión abiertas.
          </p>
          {metrics.shifts.length > 0 ? (
            <ul>
              {metrics.shifts.map((shift) => (
                <li key={shift.shiftId}>
                  <strong>{shift.activityTitle}</strong> · {shift.shiftName} ({activityStatusLabels[shift.activityStatus]}):{" "}
                  {shift.reservedCount}/{shift.capacity} reservas · {shift.attendedCount} asistencias confirmadas
                </li>
              ))}
            </ul>
          ) : (
            <p>Aún no hay turnos registrados.</p>
          )}
        </section>
      )}

      {capabilities.has("attendance_validation") && (
        <section className="stack" aria-label="Acceso rápido a turnos de asistencia">
          <h2>Control de asistencia</h2>
          <p>Elige el turno en el que vas a recibir a los participantes.</p>
          <ul className="stack">
            {shifts.map((shift) => (
              <li className="panel" key={shift.id}>
                <strong>{shift.activityTitle}</strong>
                <p>{shift.name}</p>
                <Link className="button" href={`/admin/attendance/${shift.id}`}>
                  Validar {shift.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
