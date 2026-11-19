import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { requireUser } from "../../lib/auth/session";
import { getBasicProfile } from "../../server/repositories/profile";
import { saveBasicProfileAction } from "./actions";

export const metadata = { title: "Mi perfil" };

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

const errorMessages = new Map([
  ["email_immutable", "El correo institucional UC3M no se puede modificar tras el alta."],
  ["identity_immutable", "No se puede modificar el identificador ni el estado de la cuenta."],
  ["fields", "Completa nombre, apellidos, titulación y curso respetando los límites de longitud."],
  ["missing", "No se ha encontrado la cuenta asociada a esta sesión."],
]);

const profileLinks = [
  {
    href: "/profile/talent",
    label: "Perfil de talento voluntario",
    description: "Añade de forma opcional formación, experiencia, habilidades, idiomas y enlaces externos.",
  },
  {
    href: "/profile/privacy",
    label: "Difusión y privacidad / Solicitud de supresión",
    description: "Gestiona tu decisión de difusión profesional y consulta o solicita la supresión de tu cuenta.",
  },
];

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

const fieldClass = "grid min-w-0 gap-1.5 font-bold";

const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";

const noticeClass = "rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink";

const alertClass = "rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink";

const inlineLinkClass =
  "text-brand-primary underline underline-offset-[0.22em] transition-colors hover:text-brand-ink";

export default async function ProfilePage({ searchParams }) {
  const user = await requireUser("/profile");
  const profile = await getBasicProfile(user.personId);
  const { status, error } = await searchParams;
  const errorMessage = typeof error === "string" ? errorMessages.get(error) : undefined;
  const saved = status === "saved";

  if (!profile) {
    return (
      <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
        <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-primary md:text-[2.5rem]">
          Mi perfil
        </h1>
        <p className={alertClass} role="alert">
          No se ha encontrado la cuenta asociada a esta sesión.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <p className="text-[0.9rem] font-bold text-brand-primary">Comunidad Ad Astra UC3M</p>
      <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-primary md:text-[2.5rem]">
        Mi perfil
      </h1>
      <p className="max-w-[48ch] text-[1.2rem] leading-relaxed">
        Actualiza tus datos básicos académicos. Tu correo UC3M permanece fijo para conservar tu
        identidad e historial en la comunidad.
      </p>

      {saved && (
        <p className={noticeClass} role="status">
          Has actualizado tu perfil básico correctamente.
        </p>
      )}
      {errorMessage && (
        <p className={alertClass} role="alert">
          {errorMessage}
        </p>
      )}

      <section className="grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
        <h2 className="font-display text-[1.25rem] leading-[1.22] font-normal uppercase">
          Datos básicos
        </h2>
        <form
          key={`${profile.firstName}|${profile.lastName}|${profile.degree}|${profile.course}|${profile.academicLevel ?? ""}|${profile.languageModality ?? ""}`}
          action={saveBasicProfileAction}
          className="grid min-w-0 gap-4"
        >
          <label className={fieldClass}>
            Correo UC3M (solo lectura)
            <input
              name="email"
              type="email"
              defaultValue={profile.email}
              readOnly
              aria-readonly="true"
              aria-describedby="email-immutable-help"
              className={`${inputClass} read-only:bg-brand-soft/15`}
            />
          </label>
          <p id="email-immutable-help" className={noticeClass}>
            El correo institucional identifica tu cuenta y no puede editarse desde el perfil.
          </p>

          <label className={fieldClass}>
            Nombre
            <input
              name="firstName"
              defaultValue={profile.firstName}
              maxLength={80}
              required
              className={inputClass}
            />
          </label>

          <label className={fieldClass}>
            Apellidos
            <input
              name="lastName"
              defaultValue={profile.lastName}
              maxLength={120}
              required
              className={inputClass}
            />
          </label>

          <label className={fieldClass}>
            Titulación
            <input
              name="degree"
              defaultValue={profile.degree}
              maxLength={120}
              required
              className={inputClass}
            />
          </label>

          <label className={fieldClass}>
            Curso
            <input
              name="course"
              defaultValue={profile.course}
              maxLength={40}
              required
              className={inputClass}
            />
          </label>

          <label className={fieldClass}>
            Nivel académico (opcional)
            <input
              name="academicLevel"
              defaultValue={profile.academicLevel ?? ""}
              placeholder="Ej.: Grado, Máster, Doctorado"
              maxLength={40}
              className={inputClass}
            />
          </label>

          <label className={fieldClass}>
            Modalidad de idioma (opcional)
            <input
              name="languageModality"
              defaultValue={profile.languageModality ?? ""}
              placeholder="Ej.: Español, Inglés, Bilingüe"
              maxLength={40}
              className={inputClass}
            />
          </label>

          <div>
            <button type="submit" className={primaryButtonClass}>Guardar cambios</button>
          </div>
        </form>

        {profile.privacyVersion && (
          <p>
            Aviso de privacidad aceptado: versión{" "}
            <code className="rounded bg-brand-soft/20 px-1.5 py-0.5 font-mono text-[0.9em]">
              {profile.privacyVersion}
            </code>
            {profile.privacyAcceptedAt
              ? ` el ${dateFormat.format(new Date(profile.privacyAcceptedAt))}`
              : ""}
            . <Link href="/privacy" className={inlineLinkClass}>Consultar aviso de privacidad</Link>.
          </p>
        )}
      </section>

      <nav className="mt-2" aria-label="Opciones de perfil y privacidad">
        <ul className="m-0 list-none border-t border-brand-primary/30 p-0">
          {profileLinks.map(({ href, label, description }) => (
            <li key={href} className="border-b border-brand-primary/30">
              <Link
                href={href}
                className="flex items-center justify-between gap-5 px-3 py-4 text-brand-ink no-underline transition-colors hover:bg-brand-soft/20"
              >
                <span className="grid gap-0.5">
                  <span className="text-[1.18rem] font-bold text-brand-primary underline underline-offset-[0.22em]">
                    {label}
                  </span>
                  <span>{description}</span>
                </span>
                <HugeiconsIcon
                  className="shrink-0 text-brand-primary"
                  icon={ArrowRight02Icon}
                  size={20}
                  strokeWidth={2}
                  aria-hidden="true"
                  focusable="false"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
