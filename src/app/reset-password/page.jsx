/**
 * @file Segundo paso de recuperación. La página de servidor lee el contexto de correo temporal y la acción
 * verifica el código y la nueva contraseña.
 */

import Link from "next/link";
import {
  AccountCodeField,
  InstitutionalEmailField,
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

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface";

const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";

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
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <div className="grid gap-2">
        <p className="text-[0.9rem] font-bold text-brand-primary">Comunidad Ad Astra UC3M</p>
        <h1>Restablecer contraseña</h1>
      </div>
      <div className="grid min-w-0 gap-4 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
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
          <label className="grid min-w-0 gap-1.5 font-bold">
            Nueva contraseña
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              className={inputClass}
            />
          </label>
          <label className="grid min-w-0 gap-1.5 font-bold">
            Confirmar nueva contraseña
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              className={inputClass}
            />
          </label>
          <button type="submit" className={primaryButtonClass}>Guardar nueva contraseña</button>
        </form>
        <div className="flex flex-wrap items-center gap-4">
          <BackLink href="/forgot-password">Solicitar un nuevo código</BackLink>
          <Link href="/sign-in">Acceder a la comunidad</Link>
        </div>
      </div>
    </main>
  );
}
