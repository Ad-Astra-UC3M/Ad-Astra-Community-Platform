import Link from "next/link";
import { BackLink } from "../../components/back-link";
import {
  hasPendingBrowserPasswordReset,
  submitPasswordReset,
} from "../../demo/session";

export const metadata = { title: "Restablecer contraseña" };

const errors = {
  password: "Elige una nueva contraseña de entre 8 y 128 caracteres.",
  mismatch: "Las contraseñas introducidas no coinciden.",
  invalid: "El enlace de recuperación no es válido, ya se ha utilizado o ha caducado.",
};

export default async function ResetPasswordPage({ searchParams }) {
  const { error } = await searchParams;
  const pending = await hasPendingBrowserPasswordReset();
  const message = typeof error === "string" && Object.hasOwn(errors, error)
    ? errors[error]
    : null;

  return (
    <main className="shell">
      <p className="eyebrow">Comunidad Ad Astra UC3M</p>
      <h1>Restablecer contraseña</h1>
      <div className="panel stack">
        {message && <p className="notice" role="alert">{message}</p>}
        {pending ? (
          <>
            <p>
              Define una nueva contraseña para tu cuenta. Al guardarla, este enlace quedará invalidado y se
              cerrarán las sesiones previas.
            </p>
            <form action={submitPasswordReset} className="stack" autoComplete="off">
              <label className="field">
                Nueva contraseña
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </label>
              <button type="submit" className="button">Guardar nueva contraseña</button>
            </form>
          </>
        ) : (
          <>
            <p>No hay ningún enlace de recuperación válido pendiente en este navegador.</p>
            <p>Si ya lo has usado o ha caducado, puedes solicitar uno nuevo.</p>
            <BackLink href="/forgot-password">Solicitar un nuevo enlace</BackLink>
            <Link href="/sign-in">Acceder a la comunidad</Link>
          </>
        )}
      </div>
    </main>
  );
}
