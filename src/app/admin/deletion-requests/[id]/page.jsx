/**
 * @file Ruta dinámica `/admin/deletion-requests/[id]`. Muestra el caso de supresión, su trazabilidad y
 * el formulario que lo pone en revisión o lo resuelve.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "../../../../components/back-link";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../../../components/form-styles";
import { PageHeading, pageClassName } from "../../../../components/page-layout";
import { portalAlertClassName, portalFeedbackClassName, portalPanelClassName } from "../../../../components/portal-ui";
import TextSpanWrapper2 from "../../../../institutional/components/ui/TextSpanWrapper2";
import { getDeletionRequestForReview } from "../../../../server/profiles/operations";
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

const fieldClass = "grid min-w-0 gap-1.5 font-bold";
const textareaClass = `${inputClass} min-h-[5.5rem] resize-y`;

/**
 * Next.js ejecuta este Server Component para leer getDeletionRequestForReview y preparar el
 * formulario de resolveDeletionRequestAction. Usa notFound si la solicitud falta.
 *
 * @param props - Propiedades de ruta suministradas por Next.js.
 * @param props.params - Promesa con el UUID de la solicitud que se consulta.
 * @param props.searchParams - Promesa con status y error del último intento de tramitación.
 * @returns Ficha de supresión en JSX con el formulario cuando procede, o la vista 404 si falta
 *   la solicitud.
 */
export default async function AdminDeletionRequestDetailPage({ params, searchParams }) {
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const statusCode = typeof resolvedSearch?.status === "string" ? resolvedSearch.status : "";
  const errorCode = typeof resolvedSearch?.error === "string" ? resolvedSearch.error : "";

  const request = await getDeletionRequestForReview(id);
  if (!request) notFound();

  const statusMessage = statusMessages.get(statusCode);
  const errorMessage = errorMessages.get(errorCode);

  return (
    <main className={pageClassName}>
      <BackLink href="/admin/deletion-requests">Volver a solicitudes</BackLink>
      <PageHeading
        eyebrow={`Solicitud de supresión · ${statusLabels[request.status]}`}
        title={request.personName}
        description={`${request.personEmail} · Estado de la cuenta: ${request.personStatus === "active" ? "Activa" : "Desactivada"}`}
        actions={
          <Link className={secondaryButtonClass} href={`/admin/accounts/${request.personId}`}>
            Ver ficha de la cuenta
          </Link>
        }
      />

      {statusMessage && (
        <p className={portalFeedbackClassName + " empty:hidden"} role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className={portalAlertClassName} role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className={portalPanelClassName}>
          <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
            Datos de la solicitud
          </TextSpanWrapper2>
          <span
            className={
              "inline-block w-fit rounded-sm border px-2.5 py-0.5 text-sm font-bold " +
              (request.status === "pending"
                ? "border-[#b79b30] bg-brand-accent text-brand-ink"
                : "border-brand-line bg-brand-panel text-brand-ink")
            }
          >
            {statusLabels[request.status]}
          </span>
          <dl className="grid gap-3">
            <div className="border-b border-brand-line pb-2">
              <dt className="font-bold">Fecha de creación</dt>
              <dd>{dateTimeFormat.format(new Date(request.createdAt))}</dd>
            </div>
            <div className="border-b border-brand-line pb-2">
              <dt className="font-bold">Motivo aportado</dt>
              <dd>{request.reason || "Sin motivo adicional."}</dd>
            </div>
            {request.resolutionNote && (
              <div className="border-b border-brand-line pb-2">
                <dt className="font-bold">Nota / resultado registrado</dt>
                <dd>«{request.resolutionNote}»</dd>
              </div>
            )}
          </dl>
          {request.resolvedAt && (
            <p>
              Resuelta por <strong>{request.resolvedByName ?? request.resolvedBy}</strong> el{" "}
              {dateTimeFormat.format(new Date(request.resolvedAt))}.
            </p>
          )}
        </section>

        {request.status !== "resolved" && (
          <div className="grid gap-6">
            {request.status === "pending" && (
              <section className={portalPanelClassName} aria-label="Marcar solicitud en revisión">
                <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
                  Pasar a en revisión
                </TextSpanWrapper2>
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

            <section className={portalPanelClassName} aria-label="Resolver solicitud de supresión">
              <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
                Resolver solicitud
              </TextSpanWrapper2>
              <p className={portalFeedbackClassName}>
                Al resolver se registran de forma permanente el resultado motivado, tu identidad como responsable y la fecha de cierre.
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
          </div>
        )}
      </div>
    </main>
  );
}
