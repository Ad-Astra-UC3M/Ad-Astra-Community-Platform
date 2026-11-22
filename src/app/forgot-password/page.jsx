/**
 * @file Página pública que inicia la recuperación de contraseña. La acción de cuenta decide si procede
 * solicitar el OTP.
 */

import { AccessPage } from "../../components/access-page";
import { primaryButtonClass } from "../../components/form-styles";
import { InstitutionalEmailField } from "../../components/account-code-fields";
import { BackLink } from "../../components/back-link";
import { requestPasswordResetAction } from "../auth-actions";

export const metadata = { title: "Recuperar contraseña" };

/**
 * Muestra el campo de correo institucional y lo envía a requestPasswordResetAction. Next.js convierte el
 * envío del formulario en una llamada al servidor.
 */
export default function ForgotPasswordPage() {
  return (
    <AccessPage title="Recuperar contraseña">
      <div className="grid min-w-0 gap-4">
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink">
          Introduce tu correo institucional UC3M para solicitar un código de recuperación de un
          solo uso.
        </p>
        <form action={requestPasswordResetAction} className="grid min-w-0 gap-4">
          <InstitutionalEmailField />
          <button type="submit" className={primaryButtonClass}>Solicitar recuperación</button>
        </form>
        <BackLink href="/sign-in">Volver al acceso</BackLink>
      </div>
    </AccessPage>
  );
}
