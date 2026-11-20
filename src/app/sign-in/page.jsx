import Link from "next/link";
import { readOptionalNextPath, signIn } from "../../lib/auth/session";

export const metadata = { title: "Acceder a la comunidad" };

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface";

const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";

export default async function SignInPage({ searchParams }) {
  const { error, next, reset, verified } = await searchParams;
  const safeNext = readOptionalNextPath(next);

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <div className="grid gap-2">
        <p className="text-[0.9rem] font-bold text-brand-primary">Comunidad Ad Astra UC3M</p>
        <h1>Acceder a la comunidad</h1>
      </div>
      <div className="grid min-w-0 gap-4 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
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
          <label className="grid min-w-0 gap-1.5 font-bold">
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              maxLength={128}
              required
              className={inputClass}
            />
          </label>
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
    </main>
  );
}
