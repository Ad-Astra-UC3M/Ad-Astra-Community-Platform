/**
 * Ruta /profile/privacy del App Router. Presenta la decisión vigente y el historial de
 * difusión, además del estado de la solicitud de supresión del titular.
 */

import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { getMyPrivacySettings } from "../../../server/profiles/operations";
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

/**
 * Formatea las fechas del historial y de la solicitud que muestra ProfilePrivacyPage.
 *
 * @param timestamp - Fecha o valor de fecha que se convierte a Date.
 * @returns Fecha y hora en español con la zona Europe/Madrid.
 */
function formatDateTime(timestamp) {
  return dateTimeFormat.format(new Date(timestamp));
}

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink";

const noticeClass = "rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink";

const alertClass = "rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink";

const codeClass = "rounded bg-brand-soft/20 px-1.5 py-0.5 font-mono text-[0.9em]";

/**
 * Next.js ejecuta este Server Component para leer getMyPrivacySettings. Sus formularios
 * registran decisiones de difusión y crean una solicitud de supresión.
 *
 * @param props - Propiedades de ruta suministradas por Next.js.
 * @param props.searchParams - Promesa con status y error para mostrar el resultado de los
 *   formularios.
 * @returns Vista de privacidad en JSX con estado de difusión, historial y solicitud actual o
 *   formulario de alta.
 */
export default async function ProfilePrivacyPage({ searchParams }) {
  const [{ dissemination, deletionRequest }, resolvedParams] = await Promise.all([
    getMyPrivacySettings(), searchParams,
  ]);
  const { status, error } = resolvedParams;
  const statusMessage = typeof status === "string" ? statusMessages.get(status) : undefined;
  const errorMessage = typeof error === "string" ? errorMessages.get(error) : undefined;
  const hasOpenDeletion =
    deletionRequest !== null &&
    (deletionRequest.status === "pending" || deletionRequest.status === "in_review");

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/profile">Volver a mi perfil</BackLink>
      <p className="text-[0.9rem] font-bold text-brand-primary">Control de privacidad</p>
      <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-primary md:text-[2.5rem]">
        Difusión y privacidad
      </h1>
      <p className="max-w-[48ch] text-[1.2rem] leading-relaxed">
        Gestiona por separado tu decisión sobre la difusión profesional de tu perfil de talento y
        consulta o solicita la supresión de tu cuenta.
      </p>

      {statusMessage && (
        <p className={noticeClass} role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className={alertClass} role="alert">
          {errorMessage}
        </p>
      )}

      <section className={panelClass}>
        <h2 className="font-display text-[1.25rem] leading-[1.22] font-normal uppercase">
          Decisión de difusión profesional
        </h2>
        <p>
          <strong>Estado actual:</strong>{" "}
          {dissemination.granted
            ? "Autorizada"
            : dissemination.expired
              ? "No autorizada (autorización vencida)"
              : "No autorizada (valor por defecto)"}
        </p>
        <p>
          <strong>Versión de política:</strong>{" "}
          <code className={codeClass}>{dissemination.policyVersion}</code> ·{" "}
          <strong>Finalidad:</strong> difusión interna y futura de talento (
          <code className={codeClass}>{dissemination.purpose}</code>).
        </p>
        <p className={noticeClass}>
          En esta fase del portal no están habilitadas las exportaciones ni el acceso de empresas
          externas. Negarte o retirar tu decisión no bloquea el uso del portal ni borra tu perfil de
          talento.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {!dissemination.granted ? (
            <>
              <form action={updateDisseminationAction}>
                <input type="hidden" name="granted" value="true" />
                <button type="submit" className={primaryButtonClass}>
                  Autorizar difusión profesional
                </button>
              </form>
              {dissemination.history.length === 0 && (
                <form action={updateDisseminationAction}>
                  <input type="hidden" name="granted" value="false" />
                  <button type="submit" className={secondaryButtonClass}>
                    Registrar que no autorizo
                  </button>
                </form>
              )}
            </>
          ) : (
            <form action={updateDisseminationAction}>
              <input type="hidden" name="granted" value="false" />
              <button type="submit" className={secondaryButtonClass}>
                Retirar autorización de difusión
              </button>
            </form>
          )}
        </div>

        <h3 className="text-[1.2rem] leading-[1.3]">Historial de decisiones</h3>
        {dissemination.history.length === 0 ? (
          <p>Todavía no has registrado cambios; por defecto la difusión no está concedida.</p>
        ) : (
          <ul className="grid list-disc gap-2 pl-5">
            {dissemination.history.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.granted ? "Autorizada" : "No autorizada / retirada"}</strong> · versión{" "}
                <code className={codeClass}>{entry.policyVersion}</code> ·{" "}
                <time dateTime={new Date(entry.decidedAt).toISOString()}>
                  {formatDateTime(entry.decidedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panelClass}>
        <h2 className="font-display text-[1.25rem] leading-[1.22] font-normal uppercase">
          Solicitud de supresión de cuenta
        </h2>
        <p className={noticeClass}>
          Presentar una solicitud de supresión no ejecuta un borrado automático de tu cuenta. Queda
          registrada con una referencia para su revisión y tramitación por el equipo responsable.
        </p>

        {deletionRequest && (
          <div className="grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-surface p-5 md:p-6">
            <h3 className="text-[1.2rem] leading-[1.3]">Estado de tu solicitud</h3>
            <p>
              <strong>Referencia:</strong>{" "}
              <code className={codeClass}>{deletionRequest.id}</code>
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
          <form action={requestDeletionAction} className="grid min-w-0 gap-4">
            <label className="grid min-w-0 gap-1.5 font-bold">
              Motivo (opcional)
              <textarea
                name="reason"
                rows={3}
                maxLength={1000}
                placeholder="Puedes indicar cualquier detalle útil para la tramitación."
                className="min-h-12 w-full min-w-0 resize-y rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink"
              />
            </label>
            <div>
              <button type="submit" className={secondaryButtonClass}>
                Solicitar supresión de cuenta
              </button>
            </div>
          </form>
        )}
      </section>

      <p>
        <Link
          href="/privacy"
          className="text-brand-primary underline underline-offset-[0.22em] transition-colors hover:text-brand-ink"
        >
          Consultar el aviso de privacidad completo
        </Link>
      </p>
    </main>
  );
}
