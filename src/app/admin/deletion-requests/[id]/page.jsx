import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "../../../../components/back-link";
import { getDeletionRequest } from "../../../../demo/admin";
import { requireCapability } from "../../access";
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
  ["missing_resolution_note", "Para resolver una solicitud debes redactar un resultado motivado."],
  ["missing_actor", "No se pudo identificar al responsable de la resolución."],
  ["already_resolved", "Esta solicitud ya está resuelta y no admite cambios."],
  ["missing", "No se encontró la solicitud indicada."],
]);

export default async function AdminDeletionRequestDetailPage({ params, searchParams }) {
  const admin = await requireCapability("general_admin");
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const statusCode = typeof resolvedSearch?.status === "string" ? resolvedSearch.status : "";
  const errorCode = typeof resolvedSearch?.error === "string" ? resolvedSearch.error : "";

  const request = getDeletionRequest(admin.workspaceId, id);
  if (!request) notFound();

  const statusMessage = statusMessages.get(statusCode);
  const errorMessage = errorMessages.get(errorCode);

  return (
    <main className="shell stack">
      <BackLink href="/admin/deletion-requests">Volver a solicitudes</BackLink>
      <header className="stack">
        <p className="eyebrow">Solicitud de supresión · {statusLabels[request.status]}</p>
        <h1>{request.accountName}</h1>
        <p>
          {request.accountEmail} · Estado de la cuenta:{" "}
          <strong>{request.accountStatus === "active" ? "Activa" : "Desactivada"}</strong>
        </p>
        <div>
          <Link className="button secondary" href={`/admin/accounts/${request.accountId}`}>
            Ver ficha de la cuenta
          </Link>
        </div>
      </header>

      {statusMessage && <p className="notice" role="status">{statusMessage}</p>}
      {errorMessage && <p className="notice" role="alert">{errorMessage}</p>}

      <section className="panel stack">
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
            <section className="panel stack" aria-label="Marcar solicitud en revisión">
              <h2>Pasar a en revisión</h2>
              <form action={resolveDeletionRequestAction} className="stack">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="status" value="in_review" />
                <label className="field">
                  Nota preliminar de revisión (opcional)
                  <textarea
                    name="resolutionNote"
                    rows={2}
                    maxLength={2000}
                    defaultValue={request.resolutionNote ?? ""}
                  />
                </label>
                <div>
                  <button type="submit" className="button secondary">Marcar en revisión</button>
                </div>
              </form>
            </section>
          )}

          <section className="panel stack" aria-label="Resolver solicitud de supresión">
            <h2>Resolver solicitud</h2>
            <p>
              Al resolver se registran de forma permanente el resultado motivado, tu identidad como responsable y la
              fecha de cierre.
            </p>
            <form action={resolveDeletionRequestAction} className="stack">
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="status" value="resolved" />
              <label className="field">
                Resultado motivado de la resolución
                <textarea
                  name="resolutionNote"
                  required
                  rows={4}
                  maxLength={2000}
                  defaultValue={request.resolutionNote ?? ""}
                  placeholder="Describe las actuaciones realizadas y el resultado final conforme al aviso de privacidad."
                />
              </label>
              <div>
                <button type="submit" className="button">Marcar como resuelta</button>
              </div>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
