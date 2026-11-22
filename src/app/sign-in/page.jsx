/**
 * @file Pantalla de entrada al portal. Lee el destino solicitado y las confirmaciones de cuenta y los pasa
 * al formulario de acceso.
 */

import { AccessPage } from "../../components/access-page";
import { primaryButtonClass } from "../../components/form-styles";
import Link from "next/link";
import { InstitutionalEmailField, PasswordField } from "../../components/account-code-fields";
import { readOptionalNextPath } from "../../server/auth/form-context";
import { signIn } from "../auth-actions";

export const metadata = { title: "Acceder a la comunidad" };

/**
 * Renderiza el formulario conectado a signIn. Sanea next antes de volver a enviarlo como campo oculto.
 *
 * @param props.searchParams - Promesa con next, error o avisos tras verificar el correo o restablecer la
 * contraseña.
 */
export default async function SignInPage({ searchParams }) {
  const { error, next, reset, verified } = await searchParams;
  const safeNext = readOptionalNextPath(next);

  return (
    <AccessPage title="Acceder a la comunidad">
      <div className="grid min-w-0 gap-4">
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink">
          Inicia sesión con tu cuenta verificada de correo institucional UC3M.
        </p>
        {verified === "1" && (
          <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
            Tu correo institucional UC3M ha sido verificado correctamente. Ya puedes acceder a la
            comunidad.
          </p>
        )}
        {reset === "ok" && (
          <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
            Contraseña actualizada. Inicia sesión con tu nueva contraseña.
          </p>
        )}
        {error === "credentials" && (
          <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
            Comprueba tu correo institucional UC3M y tu contraseña.
          </p>
        )}
        <form action={signIn} className="grid min-w-0 gap-4">
          <input type="hidden" name="next" value={safeNext} />
          <InstitutionalEmailField />
          <PasswordField />
          <button type="submit" className={primaryButtonClass}>Acceder</button>
        </form>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/forgot-password">¿Has olvidado tu contraseña?</Link>
          <Link href="/sign-up">Crear cuenta</Link>
          <Link href={safeNext ? "/verify-email?next=" + encodeURIComponent(safeNext) : "/verify-email"}>
            Verificar correo
          </Link>
        </div>
      </div>
    </AccessPage>
  );
}
