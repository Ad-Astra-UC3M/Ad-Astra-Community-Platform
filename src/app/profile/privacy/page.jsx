import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { getDisseminationStatus, getMyDeletionRequest } from "../../../demo/profile";
import { requireUser } from "../../../demo/session";
import { requestDeletionAction, updateDisseminationAction } from "../actions";

export const metadata = { title: "Difusión y privacidad" };

const dateTimeFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Madrid",
});

const statusMessages = new Map([
  ["dissemination_granted", "Has registrado tu autorización de difusión profesional."],
  ["dissemination_revoked", "Has registrado tu decisión de mantener la difusión desactivada. Tu perfil de talento permanece intacto."],
  ["deletion_created", "Hemos registrado tu solicitud de supresión de cuenta. No se ha ejecutado ningún borrado automático."],
  ["deletion_existing", "Ya tienes una solicitud de supresión abierta; conservamos la referencia existente sin duplicarla."],
]);

const errorMessages = new Map([
  ["invalid_decision", "No se ha podido interpretar tu decisión de difusión."],
  ["reason_too_long", "El motivo de la solicitud no puede superar los 1000 caracteres."],
  ["missing", "No se ha encontrado la cuenta asociada a esta sesión."],
]);

const deletionStatusLabels = {
  pending: "Pendiente de revisión",
  in_review: "En revisión",
  resolved: "Resuelta",
};

function formatDateTime(timestamp) {
  return dateTimeFormat.format(new Date(timestamp));
}

export default async function ProfilePrivacyPage({ searchParams }) {
  const user = await requireUser("/profile/privacy");
  const dissemination = getDisseminationStatus(user.workspaceId, user.id);
  const deletionRequest = getMyDeletionRequest(user.workspaceId, user.id);
  const { status, error } = await searchParams;
  const statusMessage = typeof status === "string" ? statusMessages.get(status) : undefined;
  const errorMessage = typeof error === "string" ? errorMessages.get(error) : undefined;
  const hasOpenDeletion =
    deletionRequest !== null &&
    (deletionRequest.status === "pending" || deletionRequest.status === "in_review");

  return (
    <main className="shell stack">
      <BackLink href="/profile">Volver a mi perfil</BackLink>
      <p className="eyebrow">Control de privacidad</p>
      <h1>Difusión y privacidad</h1>
      <p className="lead">
        Gestiona por separado tu decisión sobre la difusión profesional de tu perfil de talento y
        consulta o solicita la supresión de tu cuenta.
      </p>

      {statusMessage && (
        <p className="notice" role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className="notice" role="alert">
          {errorMessage}
        </p>
      )}

      <section className="panel stack">
        <h2>Decisión de difusión profesional</h2>
        <p>
          <strong>Estado actual:</strong>{" "}
          {dissemination.granted ? "Autorizada" : "No autorizada (valor por defecto)"}
        </p>
        <p>
          <strong>Versión de política:</strong> <code>{dissemination.policyVersion}</code> ·{" "}
          <strong>Finalidad:</strong> difusión interna y futura de talento (<code>{dissemination.purpose}</code>).
        </p>
        <p className="notice">
          En este MVP no están habilitadas las exportaciones ni el acceso de empresas externas. Negarte
          o retirar tu decisión no bloquea el uso del portal ni borra tu perfil de talento.
        </p>

        <div className="action-row">
          {!dissemination.granted ? (
            <>
              <form action={updateDisseminationAction}>
                <input type="hidden" name="granted" value="true" />
                <button type="submit" className="button">Autorizar difusión profesional</button>
              </form>
              {dissemination.history.length === 0 && (
                <form action={updateDisseminationAction}>
                  <input type="hidden" name="granted" value="false" />
                  <button type="submit" className="button secondary">Registrar que no autorizo</button>
                </form>
              )}
            </>
          ) : (
            <form action={updateDisseminationAction}>
              <input type="hidden" name="granted" value="false" />
              <button type="submit" className="button secondary">Retirar autorización de difusión</button>
            </form>
          )}
        </div>

        <h3>Historial de decisiones</h3>
        {dissemination.history.length === 0 ? (
          <p>Todavía no has registrado cambios; por defecto la difusión no está concedida.</p>
        ) : (
          <ul>
            {dissemination.history.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.granted ? "Autorizada" : "No autorizada / retirada"}</strong> · versión{" "}
                <code>{entry.policyVersion}</code> ·{" "}
                <time dateTime={new Date(entry.decidedAt).toISOString()}>
                  {formatDateTime(entry.decidedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel stack">
        <h2>Solicitud de supresión de cuenta</h2>
        <p className="notice">
          Presentar una solicitud de supresión no ejecuta un borrado automático de tu cuenta. Queda
          registrada con una referencia para su revisión y tramitación por el equipo responsable.
        </p>

        {deletionRequest && (
          <div className="panel stack">
            <h3>Estado de tu solicitud</h3>
            <p>
              <strong>Referencia:</strong> <code>{deletionRequest.id}</code>
            </p>
            <p>
              <strong>Estado actual:</strong> {deletionStatusLabels[deletionRequest.status]}
            </p>
            <p>
              <strong>Registrada el:</strong>{" "}
              <time dateTime={new Date(deletionRequest.createdAt).toISOString()}>
                {formatDateTime(deletionRequest.createdAt)}
              </time>
            </p>
            {deletionRequest.reason && (
              <p>
                <strong>Motivo indicado:</strong> {deletionRequest.reason}
              </p>
            )}
            {deletionRequest.resolutionNote && (
              <p>
                <strong>Nota de resolución:</strong> {deletionRequest.resolutionNote}
              </p>
            )}
          </div>
        )}

        {hasOpenDeletion ? (
          <p>
            Ya existe una solicitud de supresión abierta para tu cuenta; no se generará ninguna copia
            duplicada mientras siga en trámite.
          </p>
        ) : (
          <form action={requestDeletionAction} className="stack">
            <label className="field">
              Motivo (opcional)
              <textarea
                name="reason"
                rows={3}
                maxLength={1000}
                placeholder="Puedes indicar cualquier detalle útil para la tramitación."
              />
            </label>
            <div>
              <button type="submit" className="button secondary">Solicitar supresión de cuenta</button>
            </div>
          </form>
        )}
      </section>

      <p>
        <Link href="/privacy">Consultar el aviso de privacidad completo</Link>
      </p>
    </main>
  );
}
