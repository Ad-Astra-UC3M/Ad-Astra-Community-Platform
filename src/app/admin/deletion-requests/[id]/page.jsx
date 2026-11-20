import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "../../../../components/back-link";
import { getDeletionRequest } from "../../../../server/profiles/deletion-requests";
import { requireCapability } from "../../../../server/auth/access";
import { resolveDeletionRequestAction } from "../actions";

export const metadata = { title: "Detalle de solicitud de supresión" };

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

const statusMessages = new Map([
  ["in_review", "Solicitud marcada en revisión."],
  ["resolved", "Solicitud resuelta con resultado motivado, autor y fecha registrados."],
]);

const errorMessages = new Map([
  ["invalid_status", "El estado seleccionado no es válido."],
  ["invalid_date", "La fecha de resolución no es válida."],
  ["missing_resolution_note", "Para resolver una solicitud debes redactar un resultado motivado."],
  ["missing_actor", "No se pudo identificar al responsable de la resolución."],
  ["already_resolved", "Esta solicitud ya está resuelta y no admite cambios."],
  ["missing", "No se encontró la solicitud indicada."],
]);

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";
const fieldClass = "grid min-w-0 gap-1.5 font-bold";
const textareaClass =
  "min-h-12 w-full min-w-0 resize-y rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";
const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";
const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

export default async function AdminDeletionRequestDetailPage({ params, searchParams }) {
  await requireCapability("general_admin");
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const statusCode = typeof resolvedSearch?.status === "string" ? resolvedSearch.status : "";
  const errorCode = typeof resolvedSearch?.error === "string" ? resolvedSearch.error : "";

  const request = await getDeletionRequest(id);
  if (!request) notFound();

  const statusMessage = statusMessages.get(statusCode);
  const errorMessage = errorMessages.get(errorCode);

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/admin/deletion-requests">Volver a solicitudes</BackLink>
      <header className="grid min-w-0 gap-4">
        <p className="text-[0.9rem] font-bold text-brand-primary">
          Solicitud de supresión · {statusLabels[request.status]}
        </p>
        <h1>{request.personName}</h1>
        <p>
          {request.personEmail} · Estado de la cuenta:{" "}
          <strong>{request.personStatus === "active" ? "Activa" : "Desactivada"}</strong>
        </p>
        <div>
          <Link className={secondaryButtonClass} href={`/admin/accounts/${request.personId}`}>
            Ver ficha de la cuenta
          </Link>
        </div>
      </header>

      {statusMessage && (
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink empty:hidden" role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
          {errorMessage}
        </p>
      )}

      <section className={panelClass}>
        <h2>Datos de la solicitud</h2>
        <p>Fecha de creación: {dateTimeFormat.format(new Date(request.createdAt))}</p>
        <p>Motivo aportado: {request.reason || "Sin motivo adicional."}</p>
        {request.resolutionNote && (
          <p>Nota / resultado registrado: «{request.resolutionNote}»</p>
        )}
        {request.resolvedAt && (
          <p>
            Resuelta por <strong>{request.resolvedByName ?? request.resolvedBy}</strong> el{" "}
            {dateTimeFormat.format(new Date(request.resolvedAt))}.
          </p>
        )}
      </section>

      {request.status !== "resolved" && (
        <>
          {request.status === "pending" && (
            <section className={panelClass} aria-label="Marcar solicitud en revisión">
              <h2>Pasar a en revisión</h2>
              <form action={resolveDeletionRequestAction} className="grid min-w-0 gap-4">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="status" value="in_review" />
                <label className={fieldClass}>
                  Nota preliminar de revisión (opcional)
                  <textarea
                    className={textareaClass}
                    name="resolutionNote"
                    rows={2}
                    maxLength={2000}
                    defaultValue={request.resolutionNote ?? ""}
                  />
                </label>
                <div>
                  <button type="submit" className={secondaryButtonClass}>Marcar en revisión</button>
                </div>
              </form>
            </section>
          )}

          <section className={panelClass} aria-label="Resolver solicitud de supresión">
            <h2>Resolver solicitud</h2>
            <p>
              Al resolver se registran de forma permanente el resultado motivado, tu identidad como responsable y la
              fecha de cierre.
            </p>
            <form action={resolveDeletionRequestAction} className="grid min-w-0 gap-4">
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="status" value="resolved" />
              <label className={fieldClass}>
                Resultado motivado de la resolución
                <textarea
                  className={textareaClass}
                  name="resolutionNote"
                  required
                  rows={4}
                  maxLength={2000}
                  defaultValue={request.resolutionNote ?? ""}
                  placeholder="Describe las actuaciones realizadas y el resultado final conforme al aviso de privacidad."
                />
              </label>
              <div>
                <button type="submit" className={primaryButtonClass}>Marcar como resuelta</button>
              </div>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
