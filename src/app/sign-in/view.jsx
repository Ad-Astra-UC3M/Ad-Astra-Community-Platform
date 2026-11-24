/**
 * @file Vista JSX del formulario de inicio de sesión. `SignInPage` le pasa los parámetros leídos en
 * servidor y las pruebas de renderizado pueden invocarla directamente sin entorno de petición Next.js.
 */

import Link from "next/link";
import { AccessPage } from "../../components/access-page";
import { InstitutionalEmailField, PasswordField } from "../../components/account-code-fields";
import { primaryButtonClass } from "../../components/form-styles";
import { readOptionalNextPath } from "../../server/auth/form-context";
import { signIn } from "../auth-actions";

/**
 * Renderiza el formulario de acceso conectado a `signIn`. Sanea `next` antes de enviarlo en un campo
 * oculto o enlazar a la verificación de correo.
 *
 * @param props Propiedades de presentación del acceso.
 * @param props.params Avisos opcionales de consulta (`error`, `next`, `reset`, `verified`).
 * @returns Vista de entrada alojada en `AccessPage` con enlaces a recuperación, alta y verificación.
 */
export function SignInView({ params = {} }) {
  const { error, next, reset, verified } = params;
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
