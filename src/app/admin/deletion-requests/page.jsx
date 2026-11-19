import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { listDeletionRequests } from "../../../server/repositories/admin";
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

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";
const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

export default async function AdminDeletionRequestsPage() {
  await requireCapability("general_admin");
  const requests = await listDeletionRequests();

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="grid min-w-0 gap-4">
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
        <ul className="m-0 grid list-none gap-4 p-0">
          {requests.map((req) => (
            <li className={panelClass} key={req.id}>
              <p className="text-[0.9rem] font-bold text-brand-primary">{statusLabels[req.status]}</p>
              <h2>{req.personName}</h2>
              <p>
                {req.personEmail} · Creada el {dateTimeFormat.format(new Date(req.createdAt))}
                {req.resolvedAt ? ` · Resuelta el ${dateTimeFormat.format(new Date(req.resolvedAt))}` : ""}
              </p>
              {req.reason && <p>Motivo del estudiante: «{req.reason}»</p>}
              <div>
                <Link className={primaryButtonClass} href={`/admin/deletion-requests/${req.id}`}>
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
