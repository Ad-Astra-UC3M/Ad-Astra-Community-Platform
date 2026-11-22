/**
 * @file Segundo paso de recuperación. La página de servidor lee el contexto de correo temporal y la acción
 * verifica el código y la nueva contraseña.
 */

import { AccessPage } from "../../components/access-page";
import { primaryButtonClass } from "../../components/form-styles";
import Link from "next/link";
import {
  AccountCodeField,
  InstitutionalEmailField,
  PasswordField,
} from "../../components/account-code-fields";
import { BackLink } from "../../components/back-link";
import { readAccountCodeEmail } from "../../server/auth/form-context";
import { resetPasswordAction } from "../auth-actions";

export const metadata = { title: "Restablecer contraseña" };

const errors = {
  password: "Elige una nueva contraseña de entre 8 y 128 caracteres.",
  mismatch: "Las contraseñas introducidas no coinciden.",
  invalid: "El código de recuperación no es válido, ya se ha utilizado o ha caducado.",
};

/**
 * Renderiza el formulario conectado a resetPasswordAction. Lee el correo sugerido con readAccountCodeEmail.
 *
 * @param props.searchParams - Promesa con el aviso de envío y el error de recuperación, si los hay.
 */
export default async function ResetPasswordPage({ searchParams }) {
  const { sent, error } = await searchParams;
  const email = await readAccountCodeEmail("recovery");
  const message =
    typeof error === "string" && Object.hasOwn(errors, error) ? errors[error] : null;

  return (
    <AccessPage title="Restablecer contraseña">
      <div className="grid min-w-0 gap-4">
        {sent === "1" && (
          <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
            Si el correo corresponde a una cuenta verificada, recibirás un código de recuperación.
            Revisa también la carpeta de correo no deseado.
          </p>
        )}
        {message && (
          <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
            {message}
          </p>
        )}
        <p>
          Introduce el código de seis dígitos de tu correo institucional y elige una nueva
          contraseña. Al guardarla, se cerrarán las sesiones previas.
        </p>
        <form action={resetPasswordAction} className="grid min-w-0 gap-4">
          <InstitutionalEmailField defaultValue={email} />
          <AccountCodeField label="Código de recuperación" />
          <PasswordField label="Nueva contraseña" autoComplete="new-password" />
          <PasswordField name="confirmPassword" label="Confirmar nueva contraseña" autoComplete="new-password" />
          <button type="submit" className={primaryButtonClass}>Guardar nueva contraseña</button>
        </form>
        <div className="flex flex-wrap items-center gap-4">
          <BackLink href="/forgot-password">Solicitar un nuevo código</BackLink>
          <Link href="/sign-in">Acceder a la comunidad</Link>
        </div>
      </div>
    </AccessPage>
  );
}
