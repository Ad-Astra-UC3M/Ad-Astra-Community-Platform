/**
 * @file Ruta `/profile/privacy` del App Router. Presenta la decisión vigente y el historial de
 * difusión, además del estado de la solicitud de supresión del titular.
 */

import { DocumentAttachmentIcon, SecurityCheckIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../../components/form-styles";
import { PageHeading, pageClassName } from "../../../components/page-layout";
import { OrbitalMotif, portalAlertClassName, portalFeedbackClassName, portalPanelClassName } from "../../../components/portal-ui";
import TextSpanWrapper2 from "../../../institutional/components/ui/TextSpanWrapper2";
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

const codeClass = "rounded bg-brand-panel px-1.5 py-0.5 font-mono text-[0.9em]";

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
    getMyPrivacySettings(),
    searchParams,
  ]);
  const { status, error } = resolvedParams;
  const statusMessage = typeof status === "string" ? statusMessages.get(status) : undefined;
  const errorMessage = typeof error === "string" ? errorMessages.get(error) : undefined;
  const hasOpenDeletion =
    deletionRequest !== null &&
    (deletionRequest.status === "pending" || deletionRequest.status === "in_review");

  const disseminationLabel = dissemination.granted
    ? "Autorizada"
    : dissemination.expired
      ? "No autorizada (autorización vencida)"
      : "No autorizada (valor por defecto)";

  return (
    <main className={pageClassName}>
      <BackLink href="/profile">Volver a mi perfil</BackLink>
      <PageHeading
        eyebrow="Control de privacidad"
        title="Difusión y privacidad"
        description="Gestiona por separado tu decisión sobre la difusión profesional de tu perfil de talento y consulta o solicita la supresión de tu cuenta."
        actions={<OrbitalMotif className="hidden h-12 w-24 text-brand-primary/60 sm:block" />}
      />

      {statusMessage && (
        <p className={portalFeedbackClassName} role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className={portalAlertClassName} role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className={portalPanelClassName + " md:p-7"}>
          <h2 className="flex items-center gap-2 border-b border-brand-line pb-2.5">
            <HugeiconsIcon icon={SecurityCheckIcon} size={20} aria-hidden="true" className="shrink-0 text-brand-primary" />
            <TextSpanWrapper2 as="span" className="min-w-0">
              Decisión de difusión profesional
            </TextSpanWrapper2>
          </h2>
          <p
            className={
              "inline-block w-fit rounded-sm border px-3 py-1 text-sm font-bold " +
              (dissemination.granted
                ? "border-brand-primary/30 bg-brand-soft/40 text-brand-ink"
                : "border-[#b79b30] bg-brand-accent text-brand-ink")
            }
          >
            <span className="sr-only">Estado actual: </span>
            {disseminationLabel}
          </p>

          <dl className="grid gap-3">
            <div className="border-b border-brand-line pb-2">
              <dt className="font-bold">Versión de política</dt>
              <dd><code className={codeClass}>{dissemination.policyVersion}</code></dd>
            </div>
            <div className="border-b border-brand-line pb-2">
              <dt className="font-bold">Finalidad</dt>
              <dd>
                Difusión interna y futura de talento (<code className={codeClass}>{dissemination.purpose}</code>)
              </dd>
            </div>
          </dl>

          <p className={portalFeedbackClassName}>
            En esta fase del portal no están habilitadas las exportaciones ni el acceso de empresas externas. Negarte o retirar tu decisión no bloquea el uso del portal ni borra tu perfil de talento.
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

          <div className="grid gap-2 border-t border-brand-line pt-4">
            <h3 className="text-[1.15rem]">Historial de decisiones</h3>
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
          </div>
        </section>

        <section className={portalPanelClassName + " md:p-7"}>
          <h2 className="flex items-center gap-2 border-b border-brand-line pb-2.5">
            <HugeiconsIcon icon={DocumentAttachmentIcon} size={20} aria-hidden="true" className="shrink-0 text-brand-primary" />
            <TextSpanWrapper2 as="span" className="min-w-0">
              Solicitud de supresión de cuenta
            </TextSpanWrapper2>
          </h2>
          <p className={portalFeedbackClassName}>
            Presentar una solicitud de supresión no ejecuta un borrado automático de tu cuenta. Queda registrada con una referencia para su revisión y tramitación por el equipo responsable.
          </p>

          {deletionRequest && (
            <div className="grid min-w-0 gap-3 rounded-lg border border-brand-line bg-brand-panel p-5">
              <h3 className="text-[1.15rem]">Estado de tu solicitud</h3>
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
              Ya existe una solicitud de supresión abierta para tu cuenta; no se generará ninguna copia duplicada mientras siga en trámite.
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
                  className={inputClass + " min-h-[5.5rem] resize-y"}
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
      </div>

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
