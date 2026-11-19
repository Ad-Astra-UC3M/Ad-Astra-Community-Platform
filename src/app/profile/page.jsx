import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { getBasicProfile } from "../../demo/profile";
import { requireUser } from "../../demo/session";
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
  ["identity_immutable", "No se puede modificar el identificador ni el rol de la cuenta."],
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

export default async function ProfilePage({ searchParams }) {
  const user = await requireUser("/profile");
  const profile = getBasicProfile(user.workspaceId, user.id);
  const { status, error } = await searchParams;
  const errorMessage = typeof error === "string" ? errorMessages.get(error) : undefined;
  const saved = status === "saved";

  if (!profile) {
    return (
      <main className="shell stack">
        <h1>Mi perfil</h1>
        <p className="notice" role="alert">No se ha encontrado la cuenta asociada a esta sesión.</p>
      </main>
    );
  }

  return (
    <main className="shell stack">
      <p className="eyebrow">Comunidad Ad Astra UC3M</p>
      <h1>Mi perfil</h1>
      <p className="lead">
        Actualiza tus datos básicos académicos. Tu correo UC3M permanece fijo para conservar tu
        identidad e historial en la comunidad.
      </p>

      {saved && (
        <p className="notice" role="status">
          Has actualizado tu perfil básico correctamente.
        </p>
      )}
      {errorMessage && (
        <p className="notice" role="alert">
          {errorMessage}
        </p>
      )}

      <section className="panel stack">
        <h2>Datos básicos</h2>
        <form
          key={`${profile.firstName}|${profile.lastName}|${profile.degree}|${profile.course}`}
          action={saveBasicProfileAction}
          className="stack"
        >
          <label className="field">
            Correo UC3M (solo lectura)
            <input
              name="email"
              type="email"
              defaultValue={profile.email}
              readOnly
              aria-readonly="true"
              aria-describedby="email-immutable-help"
            />
          </label>
          <p id="email-immutable-help" className="notice">
            El correo institucional identifica tu cuenta y no puede editarse desde el perfil.
          </p>

          <label className="field">
            Nombre
            <input name="firstName" defaultValue={profile.firstName} maxLength={80} required />
          </label>

          <label className="field">
            Apellidos
            <input name="lastName" defaultValue={profile.lastName} maxLength={120} required />
          </label>

          <label className="field">
            Titulación
            <input name="degree" defaultValue={profile.degree} maxLength={120} required />
          </label>

          <label className="field">
            Curso
            <input name="course" defaultValue={profile.course} maxLength={40} required />
          </label>

          <div>
            <button type="submit" className="button">Guardar cambios</button>
          </div>
        </form>

        {profile.privacyVersion && (
          <p>
            Aviso de privacidad aceptado: versión <code>{profile.privacyVersion}</code>
            {profile.privacyAcceptedAt
              ? ` el ${dateFormat.format(new Date(profile.privacyAcceptedAt))}`
              : ""}
            . <Link href="/privacy">Consultar aviso de privacidad</Link>.
          </p>
        )}
      </section>

      <nav className="home-links" aria-label="Opciones de perfil y privacidad">
        <ul>
          {profileLinks.map(({ href, label, description }) => (
            <li key={href}>
              <Link href={href}>
                <span className="home-link-text">
                  <span className="home-link-title">{label}</span>
                  <span>{description}</span>
                </span>
                <HugeiconsIcon
                  className="home-link-arrow"
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
