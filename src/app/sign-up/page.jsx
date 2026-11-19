import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { signUp } from "../../demo/session";

export const metadata = { title: "Crear cuenta de prueba" };

const errors = {
  privacy: "Acepta el aviso de privacidad para continuar.",
  email: "Introduce un correo ficticio con dominio uc3m.es o uno de sus subdominios.",
  password: "Elige una contraseña de prueba de entre 8 y 128 caracteres.",
  fields: "Completa el nombre, los apellidos, la titulación y el curso.",
  duplicate: "Ya existe un alta con ese correo en este navegador.",
};

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface";

const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";

export default async function SignUpPage({ searchParams }) {
  const { error } = await searchParams;
  const message = typeof error === "string" && Object.hasOwn(errors, error)
    ? errors[error]
    : null;

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <div className="grid gap-2">
        <p className="text-[0.9rem] font-bold text-brand-primary">Comunidad Ad Astra UC3M</p>
        <h1>Crear cuenta de prueba</h1>
      </div>
      <div className="grid min-w-0 gap-4 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink">
          Usa datos inventados y una contraseña exclusiva de esta demo. Puedes editar los ejemplos.
        </p>
        {message && (
          <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
            {message}
          </p>
        )}
        {error === "duplicate" && (
          <BackLink href="/verify-email">Volver a la verificación</BackLink>
        )}
        <form action={signUp} className="grid min-w-0 gap-4" autoComplete="off">
          <label className="grid min-w-0 gap-1.5 font-bold">
            Nombre
            <input name="firstName" defaultValue="Lucía" maxLength={80} required className={inputClass} />
          </label>
          <label className="grid min-w-0 gap-1.5 font-bold">
            Apellidos
            <input name="lastName" defaultValue="Ejemplo" maxLength={120} required className={inputClass} />
          </label>
          <label className="grid min-w-0 gap-1.5 font-bold">
            Correo UC3M de prueba
            <input name="email" type="email" defaultValue="demo@alumnos.uc3m.es" maxLength={254} required className={inputClass} />
          </label>
          <label className="grid min-w-0 gap-1.5 font-bold">
            Titulación
            <input name="degree" defaultValue="Ingeniería Aeroespacial" maxLength={120} required className={inputClass} />
          </label>
          <label className="grid min-w-0 gap-1.5 font-bold">
            Curso
            <input name="course" defaultValue="2.º" maxLength={40} required className={inputClass} />
          </label>
          <label className="grid min-w-0 gap-1.5 font-bold">
            Contraseña de prueba
            <input
              name="password"
              type="password"
              defaultValue="ComunidadDemo2026!"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              className={inputClass}
            />
          </label>
          <div id="privacy-notice">
            El prototipo guarda los datos de prueba en este equipo para que puedas retomar el recorrido desde el
            mismo navegador. La verificación del correo es simulada.
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
            Acepto el <Link href="/privacy">aviso de privacidad</Link> de esta demostración.
          </label>
          <button type="submit" className={primaryButtonClass}>Crear cuenta</button>
        </form>
        <Link href="/sign-in">Ya tengo una cuenta de prueba</Link>
      </div>
    </main>
  );
}
