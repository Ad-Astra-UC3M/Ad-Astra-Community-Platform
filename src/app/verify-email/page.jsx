import Link from "next/link";
import { BackLink } from "../../components/back-link";
import {
  resendVerificationAction,
  verifyEmailByToken,
} from "../../lib/auth/session";

export const metadata = { title: "Verificar correo" };

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface";

const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink";

const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";

export default async function VerifyEmailPage({ searchParams }) {
  const { token, sent, resent } = await searchParams;
  const rawToken = typeof token === "string" ? token.trim() : "";
  const verification = rawToken ? await verifyEmailByToken(rawToken) : null;

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <div className="grid gap-2">
        <p className="text-[0.9rem] font-bold text-brand-primary">Comunidad Ad Astra UC3M</p>
        <h1>Verificar correo</h1>
      </div>

      {verification?.ok ? (
        <div className="grid min-w-0 gap-4 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
          <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
            Tu correo institucional UC3M ha sido verificado correctamente. Ya puedes acceder a la
            comunidad.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/sign-in" className={primaryButtonClass}>
              Acceder a la comunidad
            </Link>
            <Link href="/home" className={secondaryButtonClass}>
              Ir al inicio
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
          {verification && !verification.ok && (
            <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
              {verification.error === "expired"
                ? "El enlace de verificación ha caducado. Solicita un nuevo correo de verificación a continuación."
                : "El enlace de verificación no es válido o ya se ha utilizado. Puedes solicitar uno nuevo a continuación."}
            </p>
          )}
          {sent === "1" && (
            <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
              Hemos enviado un enlace de verificación a tu correo institucional UC3M. Revisa tu
              bandeja de entrada y abre el enlace para activar tu cuenta.
            </p>
          )}
          {resent === "1" && (
            <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
              Si el correo corresponde a una cuenta UC3M pendiente de verificación, hemos enviado un
              nuevo enlace de verificación.
            </p>
          )}
          <p>
            Revisa tu correo institucional UC3M (incluida la carpeta de correo no deseado) y abre el
            enlace de verificación para completar el alta.
          </p>
          <form action={resendVerificationAction} className="grid min-w-0 gap-4">
            <label className="grid min-w-0 gap-1.5 font-bold">
              Correo institucional UC3M
              <input
                name="email"
                type="email"
                placeholder="nombre@alumnos.uc3m.es"
                autoComplete="email"
                maxLength={254}
                required
                className={inputClass}
              />
            </label>
            <button type="submit" className={primaryButtonClass}>
              Reenviar correo de verificación
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-4">
            <BackLink href="/sign-up">Volver al registro</BackLink>
            <Link href="/sign-in">Acceder a la comunidad</Link>
          </div>
        </div>
      )}
    </main>
  );
}
