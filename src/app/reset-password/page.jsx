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

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface";

const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";

export default async function ResetPasswordPage({ searchParams }) {
  const { error } = await searchParams;
  const pending = await hasPendingBrowserPasswordReset();
  const message = typeof error === "string" && Object.hasOwn(errors, error)
    ? errors[error]
    : null;

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <div className="grid gap-2">
        <p className="text-[0.9rem] font-bold text-brand-primary">Comunidad Ad Astra UC3M</p>
        <h1>Restablecer contraseña</h1>
      </div>
      <div className="grid min-w-0 gap-4 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
        {message && (
          <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
            {message}
          </p>
        )}
        {pending ? (
          <>
            <p>
              Define una nueva contraseña para tu cuenta. Al guardarla, este enlace quedará invalidado y se
              cerrarán las sesiones previas.
            </p>
            <form action={submitPasswordReset} className="grid min-w-0 gap-4" autoComplete="off">
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
              <button type="submit" className={primaryButtonClass}>Guardar nueva contraseña</button>
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
