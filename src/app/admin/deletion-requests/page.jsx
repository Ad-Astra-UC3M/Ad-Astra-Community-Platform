/**
 * Ruta /admin/deletion-requests del App Router. Presenta la cola de supresiones de
 * administración general y enlaza con el detalle de cada solicitud.
 */

import Link from "next/link";
import { AdminTable } from "../admin-table";
import { BackLink } from "../../../components/back-link";
import { listDeletionRequestsForReview } from "../../../server/profiles/operations";

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

const panelClass =
  "grid min-w-0 gap-4 rounded-lg border border-brand-primary/40 bg-brand-surface p-5 md:p-6";
const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

/**
 * Next.js ejecuta este Server Component para leer listDeletionRequestsForReview, que exige
 * general_admin.
 *
 * @returns Cola de solicitudes en JSX ordenada por estado y fecha, o su estado vacío.
 */
export default async function AdminDeletionRequestsPage() {
  const requests = await listDeletionRequestsForReview();

  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-12 md:pt-12">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="grid min-w-0 gap-3 border-b border-brand-primary/40 pb-6">
        <p className="text-[0.9rem] font-bold text-brand-primary">Administración general</p>
        <h1>Solicitudes de supresión</h1>
        <p className="max-w-[48ch] text-[1.2rem] leading-[1.55]">
          Las solicitudes se tramitan con trazabilidad sin borrado automático inmediato. Toda resolución requiere un
          resultado motivado, autor y fecha.
        </p>
      </header>

      {requests.length === 0 ? (
        <section className={panelClass}>
          <p>No hay solicitudes de supresión registradas.</p>
        </section>
      ) : (
        <AdminTable label="Solicitudes recibidas" headers={["Cuenta", "Fecha de entrada", "Estado", "Resolución", "Acción"]}>
            {requests.map((req) => (
              <tr key={req.id}>
                <td><strong>{req.personName}</strong><br />{req.personEmail}{req.reason && <><br />Motivo: «{req.reason}»</>}</td>
                <td>{dateTimeFormat.format(new Date(req.createdAt))}</td>
                <td><span className="inline-block rounded border border-brand-primary/30 bg-brand-soft/25 px-2 py-1 font-bold">{statusLabels[req.status]}</span></td>
                <td>{req.resolvedAt ? dateTimeFormat.format(new Date(req.resolvedAt)) : "—"}</td>
                <td><Link className={primaryButtonClass} href={`/admin/deletion-requests/${req.id}`}>{req.status === "resolved" ? "Ver resolución" : "Gestionar solicitud"}</Link></td>
              </tr>
            ))}
          </AdminTable>
      )}
    </main>
  );
}
