import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { searchAccounts } from "../../../demo/admin";
import { requireCapability } from "../access";

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

export default async function AdminAccountsPage({ searchParams }) {
  const admin = await requireCapability("general_admin");
  const resolved = await searchParams;
  const query = typeof resolved?.query === "string" ? resolved.query : "";
  const degree = typeof resolved?.degree === "string" ? resolved.degree : "";
  const course = typeof resolved?.course === "string" ? resolved.course : "";
  const status = resolved?.status === "active" || resolved?.status === "deactivated" ? resolved.status : "";
  const hasParticipation =
    resolved?.hasParticipation === "yes" || resolved?.hasParticipation === "no"
      ? resolved.hasParticipation
      : "";

  const accounts = searchAccounts(admin.workspaceId, {
    query,
    degree,
    course,
    status,
    hasParticipation,
  });

  return (
    <main className="shell stack">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="stack">
        <p className="eyebrow">Administración general</p>
        <h1>Cuentas y permisos</h1>
        <p className="lead">
          Busca y filtra cuentas verificadas, gestiona sus capacidades independientes y activa o desactiva su acceso.
          Los perfiles de talento permanecen aislados bajo la capacidad de consulta de talento.
        </p>
      </header>

      <section className="panel stack" aria-label="Filtros de búsqueda de cuentas">
        <h2>Buscar y filtrar</h2>
        <form method="get" className="stack">
          <label className="field">
            Nombre o correo
            <input name="query" type="search" defaultValue={query} placeholder="Nombre, apellidos o correo UC3M" />
          </label>
          <label className="field">
            Titulación
            <input name="degree" type="text" defaultValue={degree} placeholder="Ingeniería Aeroespacial" />
          </label>
          <label className="field">
            Curso
            <input name="course" type="text" defaultValue={course} placeholder="3º" />
          </label>
          <label className="field">
            Estado de la cuenta
            <select name="status" defaultValue={status}>
              <option value="">Todos</option>
              <option value="active">Activa</option>
              <option value="deactivated">Desactivada</option>
            </select>
          </label>
          <label className="field">
            Participación en actividades
            <select name="hasParticipation" defaultValue={hasParticipation}>
              <option value="">Todas</option>
              <option value="yes">Con reservas</option>
              <option value="no">Sin reservas</option>
            </select>
          </label>
          <div className="action-row">
            <button type="submit" className="button">Aplicar filtros</button>
            <Link className="button secondary" href="/admin/accounts">Limpiar</Link>
          </div>
        </form>
      </section>

      <section className="stack" aria-label="Listado de cuentas">
        <h2>Resultados ({accounts.length})</h2>
        {accounts.length === 0 ? (
          <section className="panel">
            <p>No se han encontrado cuentas con los filtros indicados.</p>
          </section>
        ) : (
          <ul className="stack">
            {accounts.map((account) => (
              <li className="panel stack" key={account.id}>
                <p className="eyebrow">
                  {statusLabels[account.status]} · {account.role === "organizer" ? "Organización" : "Estudiante"}
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
                  <Link className="button secondary" href={`/admin/accounts/${account.id}`}>
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
