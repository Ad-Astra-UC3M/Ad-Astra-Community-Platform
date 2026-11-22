/**
 * @file Vista JSX de los formularios OTP de alta. VerifyEmailPage le pasa los valores ya leídos en el
 * servidor y las pruebas de render pueden pasar datos propios.
 */

import { AccessPage } from "../../components/access-page";
import { primaryButtonClass, secondaryButtonClass } from "../../components/form-styles";
import Link from "next/link";
import {
  AccountCodeField,
  InstitutionalEmailField,
} from "../../components/account-code-fields";
import { BackLink } from "../../components/back-link";
import { readOptionalNextPath } from "../../server/auth/form-context";
import { resendVerificationAction, verifyEmailAction } from "../auth-actions";

const errors = {
  email: "Introduce un correo institucional válido con dominio uc3m.es o uno de sus subdominios.",
  expired: "El código de verificación ha caducado. Solicita un nuevo código.",
  invalid: "El código de verificación no es válido o ya se ha utilizado. Comprueba el correo y usa el código más reciente.",
};

/**
 * Renderiza los formularios de confirmación y reenvío. Conecta verifyEmailAction y resendVerificationAction
 * y conserva el destino seguro.
 *
 * @param props.params - Avisos de consulta y destino interno ya leídos por la página.
 * @param props.email - Correo sugerido para los campos de los formularios.
 */
export function VerifyEmailView({ params, email }) {
  const { sent, resent, pending, error } = params;
  const next = readOptionalNextPath(params.next);
  const signInHref = next ? "/sign-in?next=" + encodeURIComponent(next) : "/sign-in";
  const message =
    typeof error === "string" && Object.hasOwn(errors, error) ? errors[error] : null;

  return (
    <AccessPage title="Verificar correo">
      <div className="grid min-w-0 gap-4">
        {message && (
          <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
            {message}
          </p>
        )}
        {sent === "1" && (
          <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
            Te hemos enviado un código de verificación a tu correo institucional UC3M.
          </p>
        )}
        {resent === "1" && (
          <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
            Si el correo corresponde a una cuenta pendiente de verificación, recibirás un
            nuevo código.
          </p>
        )}
        {pending === "1" && (
          <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
            Verifica tu correo institucional antes de acceder a la comunidad.
          </p>
        )}
        <p>
          Introduce el código de seis dígitos que recibiste por correo. Si necesitas otro,
          solicítalo y revisa también la carpeta de correo no deseado.
        </p>
        <form action={verifyEmailAction} className="grid min-w-0 gap-4">
          {next && <input type="hidden" name="next" value={next} />}
          <InstitutionalEmailField defaultValue={email} />
          <AccountCodeField label="Código de verificación" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={primaryButtonClass}>
              Confirmar correo electrónico
            </button>
            <button
              type="submit"
              formAction={resendVerificationAction}
              formNoValidate
              className={secondaryButtonClass}
            >
              Solicitar un nuevo código
            </button>
          </div>
        </form>
        <div className="flex flex-wrap items-center gap-4">
          <BackLink href="/sign-up">Volver al registro</BackLink>
          <Link href={signInHref}>Acceder a la comunidad</Link>
        </div>
      </div>
    </AccessPage>
  );
}
