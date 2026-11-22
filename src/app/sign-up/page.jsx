/**
 * @file Pantalla de alta institucional. La vista lee de la URL los errores previstos. La acción de cuenta
 * valida y persiste lo que envía el formulario.
 */

import { AccessPage } from "../../components/access-page";
import { primaryButtonClass, inputClass } from "../../components/form-styles";
import Link from "next/link";
import { InstitutionalEmailField, PasswordField } from "../../components/account-code-fields";
import { BackLink } from "../../components/back-link";
import { signUp } from "../auth-actions";

export const metadata = { title: "Crear cuenta" };

const errors = {
  privacy: "Acepta el aviso de privacidad para continuar.",
  email: "Introduce un correo institucional válido con dominio uc3m.es o uno de sus subdominios.",
  password: "Elige una contraseña de entre 8 y 128 caracteres.",
  fields: "Completa el nombre, los apellidos, la titulación y el curso.",
  duplicate: "Ya existe una cuenta registrada con ese correo institucional.",
  provider: "No hemos podido completar el registro en este momento. Inténtalo de nuevo más tarde.",
};

/**
 * Next.js renderiza el registro y conecta el formulario a la Server Action signUp.
 *
 * @param props.searchParams - Promesa con el código de error opcional devuelto por la acción.
 */
export default async function SignUpPage({ searchParams }) {
  const { error } = await searchParams;
  const message =
    typeof error === "string" && Object.hasOwn(errors, error)
      ? errors[error]
      : null;

  return (
    <AccessPage title="Crear cuenta" artwork="registration">
      <div className="grid min-w-0 gap-4">
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink">
          Regístrate con tu correo institucional UC3M (<code>@alumnos.uc3m.es</code> o{" "}
          <code>@uc3m.es</code>). Te enviaremos un código para verificar tu dirección antes de acceder.
        </p>
        {message && (
          <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
            {message}
          </p>
        )}
        {error === "duplicate" && (
          <div className="flex flex-wrap items-center gap-4">
            <BackLink href="/sign-in">Acceder a la comunidad</BackLink>
            <Link href="/verify-email">Solicitar un código de verificación</Link>
          </div>
        )}
        <form action={signUp} className="grid min-w-0 gap-4 sm:grid-cols-2">
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
          <InstitutionalEmailField className="sm:col-span-2" />
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
          <PasswordField autoComplete="new-password" className="sm:col-span-2" />
          <div id="privacy-notice" className="sm:col-span-2">
            Tu cuenta se activará cuando verifiques el correo. Después, la dirección quedará
            vinculada a tu identidad e historial en la comunidad.
          </div>
          <label className="cursor-pointer sm:col-span-2">
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
    </AccessPage>
  );
}
