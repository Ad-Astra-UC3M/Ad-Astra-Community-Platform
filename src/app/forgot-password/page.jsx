import Link from "next/link";
import { BackLink } from "../../components/back-link";
import {
  hasPendingBrowserPasswordReset,
  submitPasswordResetRequest,
} from "../../demo/session";

export const metadata = { title: "Recuperar contraseña" };

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface";

const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";

export default async function ForgotPasswordPage({ searchParams }) {
  const { sent } = await searchParams;
  const pending = await hasPendingBrowserPasswordReset();

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <div className="grid gap-2">
        <p className="text-[0.9rem] font-bold text-brand-primary">Comunidad Ad Astra UC3M</p>
        <h1>Recuperar contraseña</h1>
      </div>
      <div className="grid min-w-0 gap-4 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink">
          Introduce el correo UC3M de tu cuenta de prueba para generar un enlace de recuperación de un solo uso.
        </p>
        {sent === "1" && (
          <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
            Si el correo corresponde a una cuenta verificada, hemos preparado el enlace de recuperación.
          </p>
        )}
        <form action={submitPasswordResetRequest} className="grid min-w-0 gap-4" autoComplete="off">
          <label className="grid min-w-0 gap-1.5 font-bold">
            Correo UC3M de prueba
            <input name="email" type="email" defaultValue="demo@alumnos.uc3m.es" maxLength={254} required className={inputClass} />
          </label>
          <button type="submit" className={primaryButtonClass}>Solicitar recuperación</button>
        </form>
        <BackLink href="/sign-in">Volver al acceso</BackLink>
      </div>
      {pending && (
        <div className="grid min-w-0 gap-4 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
          <h2>Enlace de recuperación en la demo</h2>
          <p>En esta demostración puedes abrir directamente el enlace de un solo uso desde aquí.</p>
          <Link className={primaryButtonClass} href="/reset-password">Abrir enlace de recuperación</Link>
        </div>
      )}
    </main>
  );
}
