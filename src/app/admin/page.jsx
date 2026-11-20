import Link from "next/link";
import { loadAdminDashboard } from "../../server/accounts/operations";

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

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";
const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

export default async function AdminPage() {
  const { capabilities, metrics, shifts } = await loadAdminDashboard();
  const visibleModules = moduleCards.filter((card) => capabilities.includes(card.capability));

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <header className="grid min-w-0 gap-4">
        <p className="text-[0.9rem] font-bold text-brand-primary">Organización</p>
        <h1>Panel administrativo</h1>
        <p className="max-w-[48ch] text-[1.2rem] leading-[1.55]">
          Accede únicamente a los módulos autorizados para tus capacidades activas:{" "}
          {capabilities.map((cap) => capabilityLabels[cap] ?? cap).join(", ")}.
        </p>
      </header>

      <section className="grid min-w-0 gap-4" aria-label="Módulos administrativos disponibles">
        <h2>Módulos habilitados</h2>
        <ul className="m-0 grid list-none gap-4 p-0">
          {visibleModules.map((mod) => (
            <li className={panelClass} key={mod.href}>
              <h3>{mod.title}</h3>
              <p>{mod.description}</p>
              <div>
                <Link className={primaryButtonClass} href={mod.href}>{mod.cta}</Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {metrics && (
        <section className={panelClass} aria-label="Resumen de métricas">
          <h2>Métricas de la comunidad</h2>
          <p>
            <strong>{metrics.totalAccounts}</strong> cuentas verificadas ({metrics.activeAccounts} activas,{" "}
            {metrics.deactivatedAccounts} desactivadas) ·{" "}
            <strong>{metrics.pendingDeletionRequests}</strong> solicitudes de supresión abiertas.
          </p>
          {metrics.shifts.length > 0 ? (
            <ul className="grid list-disc gap-1.5 pl-6">
              {metrics.shifts.map((shift) => (
                <li key={shift.shiftId}>
                  <strong>{shift.activityTitle}</strong> · {shift.shiftName} ({activityStatusLabels[shift.activityStatus]}):{" "}
                  {shift.capacity === null
                    ? `${shift.reservedCount} reservas (aforo ilimitado)`
                    : `${shift.reservedCount}/${shift.capacity} reservas`}{" "}
                  · {shift.attendedCount} asistencias confirmadas
                </li>
              ))}
            </ul>
          ) : (
            <p>Aún no hay turnos registrados.</p>
          )}
        </section>
      )}

      {capabilities.includes("attendance_validation") && (
        <section className="grid min-w-0 gap-4" aria-label="Acceso rápido a turnos de asistencia">
          <h2>Control de asistencia</h2>
          <p>Elige el turno en el que vas a recibir a los participantes.</p>
          <ul className="m-0 grid list-none gap-4 p-0">
            {shifts.map((shift) => (
              <li className={panelClass} key={shift.id}>
                <strong>{shift.activityTitle}</strong>
                <p>{shift.name}</p>
                <Link className={primaryButtonClass} href={`/admin/attendance/${shift.id}`}>
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
