/**
 * @file Ruta `/admin` del App Router. Orquesta la vista inicial de administración a partir de las
 * capacidades de sesión y los datos que permite cada una.
 */

import {
  Briefcase01Icon,
  Calendar03Icon,
  Delete02Icon,
  Folder01Icon,
  GridViewIcon,
  QrCodeIcon,
  User03Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { primaryButtonClass, secondaryButtonClass } from "../../components/form-styles";
import { PageHeading, pageClassName } from "../../components/page-layout";
import { OrbitalMotif, PortalIcon, portalMutedPanelClassName, portalPanelClassName } from "../../components/portal-ui";
import TextSpanWrapper2 from "../../institutional/components/ui/TextSpanWrapper2";
import { loadAdminDashboard } from "../../server/accounts/operations";
import { AdminTable } from "./admin-table";

export const metadata = { title: "Panel de administración" };

const moduleCards = [
  {
    icon: QrCodeIcon,
    capability: "attendance_validation",
    href: "/admin/attendance",
    title: "Validación de asistencia",
    description: "Escanea tarjetas QR, inscribe en puerta con plaza disponible y corrige asistencias con auditoría.",
    cta: "Abrir control de asistencia",
  },
  {
    icon: Calendar03Icon,
    capability: "content_editing",
    href: "/admin/activities",
    title: "Edición de actividades",
    description: "Crea actividades con turnos e imágenes ordenadas, ajusta aforos y gestiona su publicación o archivo.",
    cta: "Gestionar actividades",
  },
  {
    icon: Briefcase01Icon,
    capability: "content_editing",
    href: "/admin/opportunities",
    title: "Edición de oportunidades",
    description: "Publica, edita estados o archiva oportunidades de prácticas e investigación.",
    cta: "Gestionar oportunidades",
  },
  {
    icon: UserGroupIcon,
    capability: "general_admin",
    href: "/admin/accounts",
    title: "Cuentas y permisos",
    description: "Consulta cuentas registradas, gestiona capacidades independientes y activa o desactiva accesos.",
    cta: "Gestionar cuentas",
  },
  {
    icon: Delete02Icon,
    capability: "general_admin",
    href: "/admin/deletion-requests",
    title: "Solicitudes de supresión",
    description: "Revisa y resuelve de forma motivada las solicitudes de supresión de cuenta.",
    cta: "Ver solicitudes",
  },
  {
    icon: Folder01Icon,
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

/**
 * Next.js ejecuta este Server Component para consultar loadAdminDashboard y seleccionar los
 * módulos autorizados.
 *
 * @returns Panel en JSX con enlaces por capacidad y las secciones de métricas y turnos cuando
 *   corresponden.
 */
export default async function AdminPage() {
  const { capabilities, metrics, shifts } = await loadAdminDashboard();
  const visibleModules = moduleCards.filter((card) => capabilities.includes(card.capability));

  return (
    <main className={pageClassName}>
      <PageHeading
        eyebrow="Organización"
        title="Panel administrativo"
        description={`Accede únicamente a los módulos autorizados para tus capacidades activas: ${capabilities.map((cap) => capabilityLabels[cap] ?? cap).join(", ")}.`}
        actions={<OrbitalMotif className="hidden h-12 w-24 text-brand-primary/60 sm:block" />}
      />

      {capabilities.includes("attendance_validation") && (
        <section className={portalMutedPanelClassName} aria-label="Acceso rápido a turnos de asistencia">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line pb-2.5">
            <h2 className="flex items-center gap-2.5">
              <PortalIcon icon={Calendar03Icon} size={21} className="text-brand-primary" />
              <TextSpanWrapper2 as="span" className="min-w-0">
                Control de asistencia
              </TextSpanWrapper2>
            </h2>
            <Link href="/admin/attendance" className={secondaryButtonClass}>Ver todos los turnos</Link>
          </div>
          <p>Elige el turno en el que vas a recibir a los participantes.</p>
          {shifts.length > 0 ? (
            <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
              {shifts.map((shift) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-brand-line bg-brand-surface p-4"
                  key={shift.id}
                >
                  <div className="grid gap-0.5">
                    <strong className="text-lg text-brand-ink">{shift.activityTitle}</strong>
                    <p className="text-[0.95rem]">Turno {shift.name}</p>
                  </div>
                  <Link className={primaryButtonClass} href={`/admin/attendance/${shift.id}`}>
                    Validar {shift.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>Aún no hay turnos disponibles.</p>
          )}
        </section>
      )}

      <section className="grid min-w-0 gap-4" aria-label="Módulos administrativos disponibles">
        <h2 className="flex items-center gap-2.5 border-b border-brand-line pb-2.5">
          <PortalIcon icon={GridViewIcon} size={21} className="text-brand-primary" />
          <TextSpanWrapper2 as="span" className="min-w-0">
            Módulos habilitados
          </TextSpanWrapper2>
        </h2>
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {visibleModules.map((mod) => (
            <li
              className="grid min-w-0 content-between gap-4 rounded-lg border border-brand-line bg-brand-surface p-5"
              key={mod.href}
            >
              <div className="grid gap-2.5">
                <h3 className="flex items-center gap-3 font-serif text-xl font-bold text-brand-ink">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-soft/40 text-brand-primary">
                    <PortalIcon icon={mod.icon} size={20} />
                  </span>
                  <span>{mod.title}</span>
                </h3>
                <p>{mod.description}</p>
              </div>
              <div>
                <Link className={secondaryButtonClass} href={mod.href}>{mod.cta}</Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {metrics && (
        <section className={portalPanelClassName} aria-label="Resumen de métricas">
          <h2 className="flex items-center gap-2.5 border-b border-brand-line pb-2.5">
            <PortalIcon icon={User03Icon} size={21} className="text-brand-primary" />
            <TextSpanWrapper2 as="span" className="min-w-0">
              Métricas de la comunidad
            </TextSpanWrapper2>
          </h2>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-brand-line bg-brand-line sm:grid-cols-4">
            <div className="grid gap-1 bg-brand-surface p-4">
              <strong className="font-serif text-3xl leading-none font-bold text-brand-ink">{metrics.totalAccounts}</strong>
              <span className="text-sm">Cuentas verificadas</span>
            </div>
            <div className="grid gap-1 bg-brand-surface p-4">
              <strong className="font-serif text-3xl leading-none font-bold text-brand-ink">{metrics.activeAccounts}</strong>
              <span className="text-sm">Activas</span>
            </div>
            <div className="grid gap-1 bg-brand-surface p-4">
              <strong className="font-serif text-3xl leading-none font-bold text-brand-ink">{metrics.deactivatedAccounts}</strong>
              <span className="text-sm">Desactivadas</span>
            </div>
            <div className="grid gap-1 bg-brand-panel p-4">
              <strong className="font-serif text-3xl leading-none font-bold text-brand-ink">{metrics.pendingDeletionRequests}</strong>
              <span className="text-sm">Solicitudes abiertas</span>
            </div>
          </div>
          {metrics.shifts.length > 0 ? (
            <AdminTable
              label="Resumen de ocupación por turno"
              headers={["Actividad", "Turno", "Estado", "Ocupación", "Asistencias"]}
            >
              {metrics.shifts.map((shift) => (
                <tr key={shift.shiftId}>
                  <td><strong>{shift.activityTitle}</strong></td>
                  <td>{shift.shiftName}</td>
                  <td>{activityStatusLabels[shift.activityStatus]}</td>
                  <td>
                    {shift.capacity === null
                      ? `${shift.reservedCount} reservas (ilimitado)`
                      : `${shift.reservedCount}/${shift.capacity} reservas`}
                  </td>
                  <td>{shift.attendedCount} confirmadas</td>
                </tr>
              ))}
            </AdminTable>
          ) : (
            <p>Aún no hay turnos registrados.</p>
          )}
        </section>
      )}
    </main>
  );
}
