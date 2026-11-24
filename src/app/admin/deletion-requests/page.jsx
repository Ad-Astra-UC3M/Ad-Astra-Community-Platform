/**
 * @file Ruta `/admin/deletion-requests` del App Router. Presenta la cola de supresiones de
 * administración general y enlaza con el detalle de cada solicitud.
 */

import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { primaryButtonClass } from "../../../components/form-styles";
import { PageHeading, pageClassName } from "../../../components/page-layout";
import { portalPanelClassName } from "../../../components/portal-ui";
import { listDeletionRequestsForReview } from "../../../server/profiles/operations";
import { AdminTable } from "../admin-table";

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

/**
 * Next.js ejecuta este Server Component para leer listDeletionRequestsForReview, que exige
 * general_admin.
 *
 * @returns Cola de solicitudes en JSX ordenada por estado y fecha, o su estado vacío.
 */
export default async function AdminDeletionRequestsPage() {
  const requests = await listDeletionRequestsForReview();

  return (
    <main className={pageClassName}>
      <BackLink href="/admin">Volver al panel</BackLink>
      <PageHeading
        eyebrow="Administración general"
        title="Solicitudes de supresión"
        description="Las solicitudes se tramitan con trazabilidad sin borrado automático inmediato. Toda resolución requiere un resultado motivado, autor y fecha."
      />

      {requests.length === 0 ? (
        <section className={portalPanelClassName}>
          <p>No hay solicitudes de supresión registradas.</p>
        </section>
      ) : (
        <AdminTable label="Solicitudes recibidas" headers={["Cuenta", "Fecha de entrada", "Estado", "Resolución", "Acción"]}>
          {requests.map((req) => (
            <tr key={req.id}>
              <td>
                <strong>{req.personName}</strong>
                <br />
                {req.personEmail}
                {req.reason && (
                  <>
                    <br />
                    Motivo: «{req.reason}»
                  </>
                )}
              </td>
              <td>{dateTimeFormat.format(new Date(req.createdAt))}</td>
              <td>
                <span
                  className={
                    "inline-block rounded-sm border px-2.5 py-0.5 text-sm font-bold " +
                    (req.status === "pending"
                      ? "border-[#b79b30] bg-brand-accent text-brand-ink"
                      : req.status === "in_review"
                        ? "border-brand-line bg-brand-soft/45 text-brand-ink"
                        : "border-brand-line bg-brand-panel text-brand-ink")
                  }
                >
                  {statusLabels[req.status]}
                </span>
              </td>
              <td>{req.resolvedAt ? dateTimeFormat.format(new Date(req.resolvedAt)) : "—"}</td>
              <td>
                <Link className={primaryButtonClass} href={`/admin/deletion-requests/${req.id}`}>
                  {req.status === "resolved" ? "Ver resolución" : "Gestionar solicitud"}
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </main>
  );
}
