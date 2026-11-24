/**
 * @file Vista JSX de los formularios OTP de alta. VerifyEmailPage le pasa los valores ya leídos en el
 * servidor y las pruebas de render pueden pasar datos propios.
 */

import Link from "next/link";
import {
  AccountCodeField,
  InstitutionalEmailField,
} from "../../components/account-code-fields";
import { BackLink } from "../../components/back-link";
import { readOptionalNextPath } from "../../server/auth/form-context";
import { resendVerificationAction, verifyEmailAction } from "../auth-actions";

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface";

const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink";

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
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <div className="grid gap-2">
        <p className="text-[0.9rem] font-bold text-brand-primary">Comunidad Ad Astra UC3M</p>
        <h1>Verificar correo</h1>
      </div>

      <div className="grid min-w-0 gap-4 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
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
    </main>
  );
}
