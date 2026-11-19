import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { listDeletionRequests } from "../../../demo/admin";
import { requireCapability } from "../access";

export const metadata = { title: "Solicitudes de supresión" };

const statusLabels = {
  pending: "Pendiente",
  in_review: "En revisión",
  resolved: "Resuelta",
};

const dateTimeFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export default async function AdminDeletionRequestsPage() {
  const admin = await requireCapability("general_admin");
  const requests = listDeletionRequests(admin.workspaceId);

  return (
    <main className="shell stack">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="stack">
        <p className="eyebrow">Administración general</p>
        <h1>Solicitudes de supresión</h1>
        <p className="lead">
          Las solicitudes se tramitan con trazabilidad sin borrado automático inmediato. Toda resolución requiere un
          resultado motivado, autor y fecha.
        </p>
      </header>

      {requests.length === 0 ? (
        <section className="panel">
          <p>No hay solicitudes de supresión registradas.</p>
        </section>
      ) : (
        <ul className="stack">
          {requests.map((req) => (
            <li className="panel stack" key={req.id}>
              <p className="eyebrow">{statusLabels[req.status]}</p>
              <h2>{req.accountName}</h2>
              <p>
                {req.accountEmail} · Creada el {dateTimeFormat.format(new Date(req.createdAt))}
                {req.resolvedAt ? ` · Resuelta el ${dateTimeFormat.format(new Date(req.resolvedAt))}` : ""}
              </p>
              {req.reason && <p>Motivo del estudiante: «{req.reason}»</p>}
              <div>
                <Link className="button" href={`/admin/deletion-requests/${req.id}`}>
                  {req.status === "resolved" ? "Ver resolución" : "Gestionar solicitud"}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
