/**
 * Ruta /admin/accounts del App Router. Muestra la búsqueda de cuentas para administración
 * general y enlaza cada resultado con su ficha.
 */

import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { searchAdminAccounts } from "../../../server/accounts/operations";

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

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";
const fieldClass = "grid min-w-0 gap-1.5 font-bold";
const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";
const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";
const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

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
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="grid min-w-0 gap-4">
        <p className="text-[0.9rem] font-bold text-brand-primary">Administración general</p>
        <h1>Cuentas y permisos</h1>
        <p className="max-w-[48ch] text-[1.2rem] leading-[1.55]">
          Busca y filtra cuentas verificadas, gestiona sus capacidades independientes y activa o desactiva su acceso.
          Los perfiles de talento permanecen aislados bajo la capacidad de consulta de talento.
        </p>
      </header>

      <section className={panelClass} aria-label="Filtros de búsqueda de cuentas">
        <h2>Buscar y filtrar</h2>
        <form method="get" className="grid min-w-0 gap-4">
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
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={primaryButtonClass}>Aplicar filtros</button>
            <Link className={secondaryButtonClass} href="/admin/accounts">Limpiar</Link>
          </div>
        </form>
      </section>

      <section className="grid min-w-0 gap-4" aria-label="Listado de cuentas">
        <h2>Resultados ({accounts.length})</h2>
        {accounts.length === 0 ? (
          <section className={panelClass}>
            <p>No se han encontrado cuentas con los filtros indicados.</p>
          </section>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0">
            {accounts.map((account) => (
              <li className={panelClass} key={account.id}>
                <p className="text-[0.9rem] font-bold text-brand-primary">
                  {statusLabels[account.status]} · {account.capabilities.length > 0 ? "Organización" : "Estudiante"}
                </p>
                <h3>{account.name}</h3>
                <p>
                  {account.email}
                  {account.degree ? ` · ${account.degree}` : ""}
                  {account.course ? ` (${account.course})` : ""}
                </p>
                <p>
                  Reservas: {account.reservationCount} · Asistencias confirmadas: {account.attendedCount}
                </p>
                <p>
                  Capacidades:{" "}
                  {account.capabilities.length > 0
                    ? account.capabilities.map((cap) => capabilityLabels[cap] ?? cap).join(", ")
                    : "Sin capacidades administrativas"}
                </p>
                <div>
                  <Link className={secondaryButtonClass} href={`/admin/accounts/${account.id}`}>
                    Ver ficha y permisos
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
