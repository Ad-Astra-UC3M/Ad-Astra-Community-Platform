import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { signUp } from "../../lib/auth/session";

export const metadata = { title: "Crear cuenta" };

const errors = {
  privacy: "Acepta el aviso de privacidad para continuar.",
  email: "Introduce un correo institucional válido con dominio uc3m.es o uno de sus subdominios.",
  password: "Elige una contraseña de entre 8 y 128 caracteres.",
  fields: "Completa el nombre, los apellidos, la titulación y el curso.",
  duplicate: "Ya existe una cuenta registrada con ese correo institucional.",
  provider: "No hemos podido completar el registro en este momento. Inténtalo de nuevo más tarde.",
};

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface";

const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";

export default async function SignUpPage({ searchParams }) {
  const { error } = await searchParams;
  const message =
    typeof error === "string" && Object.hasOwn(errors, error)
      ? errors[error]
      : null;

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <div className="grid gap-2">
        <p className="text-[0.9rem] font-bold text-brand-primary">Comunidad Ad Astra UC3M</p>
        <h1>Crear cuenta</h1>
      </div>
      <div className="grid min-w-0 gap-4 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink">
          Regístrate con tu correo institucional UC3M (<code>@alumnos.uc3m.es</code> o{" "}
          <code>@uc3m.es</code>). Te enviaremos un enlace para verificar tu dirección antes de acceder.
        </p>
        {message && (
          <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
            {message}
          </p>
        )}
        {error === "duplicate" && (
          <div className="flex flex-wrap items-center gap-4">
            <BackLink href="/sign-in">Acceder a la comunidad</BackLink>
            <Link href="/verify-email">Reenviar correo de verificación</Link>
          </div>
        )}
        <form action={signUp} className="grid min-w-0 gap-4">
          <label className="grid min-w-0 gap-1.5 font-bold">
            Nombre
            <input
              name="firstName"
              placeholder="Ej.: Lucía"
              autoComplete="given-name"
              maxLength={80}
              required
              className={inputClass}
            />
          </label>
          <label className="grid min-w-0 gap-1.5 font-bold">
            Apellidos
            <input
              name="lastName"
              placeholder="Ej.: García Martín"
              autoComplete="family-name"
              maxLength={120}
              required
              className={inputClass}
            />
          </label>
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
            Titulación
            <input
              name="degree"
              placeholder="Ej.: Ingeniería Aeroespacial"
              maxLength={120}
              required
              className={inputClass}
            />
          </label>
          <label className="grid min-w-0 gap-1.5 font-bold">
            Curso
            <input
              name="course"
              placeholder="Ej.: 2.º"
              maxLength={40}
              required
              className={inputClass}
            />
          </label>
          <label className="grid min-w-0 gap-1.5 font-bold">
            Contraseña
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
          <div id="privacy-notice">
            Recibirás un enlace de verificación en tu correo institucional UC3M. Tu cuenta quedará
            activa al confirmar ese enlace y tu correo permanecerá fijo para conservar tu identidad e
            historial en la comunidad.
          </div>
          <label className="cursor-pointer">
            <input
              type="checkbox"
              name="privacy"
              value="accepted"
              aria-describedby="privacy-notice"
              required
              className="mr-1.5 inline-block size-[1.15em] align-[-0.15em] accent-brand-primary"
            />{" "}
            Acepto el <Link href="/privacy">aviso de privacidad</Link> de la Comunidad Ad Astra UC3M.
          </label>
          <button type="submit" className={primaryButtonClass}>Crear cuenta</button>
        </form>
        <Link href="/sign-in">Ya tengo una cuenta</Link>
      </div>
    </main>
  );
}
