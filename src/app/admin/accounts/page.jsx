/**
 * @file Ruta `/admin/accounts` del App Router. Muestra la búsqueda de cuentas para administración
 * general y enlaza cada resultado con su ficha.
 */

import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../../components/form-styles";
import { PageHeading, pageClassName } from "../../../components/page-layout";
import { portalMutedPanelClassName, portalPanelClassName } from "../../../components/portal-ui";
import TextSpanWrapper2 from "../../../institutional/components/ui/TextSpanWrapper2";
import { searchAdminAccounts } from "../../../server/accounts/operations";
import { AdminTable } from "../admin-table";

export const metadata = { title: "Cuentas y permisos" };

const capabilityLabels = {
  general_admin: "Administración general",
  content_editing: "Edición de contenido",
  attendance_validation: "Validación de asistencia",
  talent_consultation: "Consulta de talento",
};

const statusLabels = {
  active: "Activa",
  deactivated: "Desactivada",
};

const fieldClass = "grid min-w-0 gap-1.5 font-bold";

/**
 * Next.js ejecuta este Server Component para traducir los filtros de la URL y consultar
 * searchAdminAccounts.
 *
 * @param props - Propiedades de ruta suministradas por Next.js.
 * @param props.searchParams - Promesa con query, degree, course, status y hasParticipation para
 *   filtrar cuentas.
 * @returns Listado de cuentas en JSX con los filtros activos y los enlaces a sus fichas.
 */
export default async function AdminAccountsPage({ searchParams }) {
  const resolved = await searchParams;
  const query = typeof resolved?.query === "string" ? resolved.query : "";
  const degree = typeof resolved?.degree === "string" ? resolved.degree : "";
  const course = typeof resolved?.course === "string" ? resolved.course : "";
  const status = resolved?.status === "active" || resolved?.status === "deactivated" ? resolved.status : "";
  const hasParticipation =
    resolved?.hasParticipation === "yes" || resolved?.hasParticipation === "no"
      ? resolved.hasParticipation
      : "";

  const accounts = await searchAdminAccounts({
    query,
    degree,
    course,
    status,
    hasParticipation,
  });

  return (
    <main className={pageClassName}>
      <BackLink href="/admin">Volver al panel</BackLink>
      <PageHeading
        eyebrow="Administración general"
        title="Cuentas y permisos"
        description="Busca y filtra cuentas verificadas, gestiona sus capacidades independientes y activa o desactiva su acceso. Los perfiles de talento permanecen aislados bajo la capacidad de consulta de talento."
      />

      <section className={portalMutedPanelClassName} aria-label="Filtros de búsqueda de cuentas">
        <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
          Buscar y filtrar
        </TextSpanWrapper2>
        <form method="get" className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className={fieldClass}>
            Nombre o correo
            <input className={inputClass} name="query" type="search" defaultValue={query} placeholder="Nombre, apellidos o correo UC3M" />
          </label>
          <label className={fieldClass}>
            Titulación
            <input className={inputClass} name="degree" type="text" defaultValue={degree} placeholder="Ingeniería Aeroespacial" />
          </label>
          <label className={fieldClass}>
            Curso
            <input className={inputClass} name="course" type="text" defaultValue={course} placeholder="3º" />
          </label>
          <label className={fieldClass}>
            Estado de la cuenta
            <select className={inputClass} name="status" defaultValue={status}>
              <option value="">Todos</option>
              <option value="active">Activa</option>
              <option value="deactivated">Desactivada</option>
            </select>
          </label>
          <label className={fieldClass}>
            Participación en actividades
            <select className={inputClass} name="hasParticipation" defaultValue={hasParticipation}>
              <option value="">Todas</option>
              <option value="yes">Con reservas</option>
              <option value="no">Sin reservas</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <button type="submit" className={primaryButtonClass}>Aplicar filtros</button>
            <Link className={secondaryButtonClass} href="/admin/accounts">Limpiar</Link>
          </div>
        </form>
      </section>

      <section className="grid min-w-0 gap-4" aria-label="Listado de cuentas">
        <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
          {`Resultados (${accounts.length})`}
        </TextSpanWrapper2>
        {accounts.length === 0 ? (
          <section className={portalPanelClassName}>
            <p>No se han encontrado cuentas con los filtros indicados.</p>
          </section>
        ) : (
          <AdminTable label="Resultados de cuentas" headers={["Cuenta", "Estado", "Participación", "Capacidades", "Acción"]}>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>
                  <strong>{account.name}</strong>
                  <br />
                  {account.email}
                  {(account.degree || account.course) && (
                    <>
                      <br />
                      {account.degree}
                      {account.course ? ` (${account.course})` : ""}
                    </>
                  )}
                </td>
                <td>
                  <span
                    className={
                      "inline-block rounded-sm border px-2.5 py-0.5 text-sm font-bold " +
                      (account.status === "active"
                        ? "border-[#b79b30] bg-brand-accent text-brand-ink"
                        : "border-brand-line bg-brand-soft/45 text-brand-ink")
                    }
                  >
                    {statusLabels[account.status]}
                  </span>
                  <br />
                  <span className="text-sm">{account.capabilities.length > 0 ? "Organización" : "Estudiante"}</span>
                </td>
                <td>{account.reservationCount} reservas · {account.attendedCount} asistencias</td>
                <td>
                  {account.capabilities.length
                    ? account.capabilities.map((cap) => capabilityLabels[cap] ?? cap).join(", ")
                    : "Sin capacidades administrativas"}
                </td>
                <td>
                  <Link className={secondaryButtonClass} href={`/admin/accounts/${account.id}`}>
                    Ver ficha y permisos
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </section>
    </main>
  );
}
