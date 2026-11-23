/**
 * @file Ruta `/profile` del App Router. Presenta el perfil básico del titular identificado por la
 * sesión y enlaza con sus opciones de talento y privacidad.
 */

import { ArrowRight02Icon, Folder01Icon, SecurityCheckIcon, Settings02Icon, User03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { inputClass, primaryButtonClass } from "../../components/form-styles";
import { PageHeading, pageClassName } from "../../components/page-layout";
import { OrbitalMotif, portalAlertClassName, portalFeedbackClassName, portalPanelClassName } from "../../components/portal-ui";
import { ProfileAvatar } from "../../components/profile-avatar";
import TextSpanWrapper2 from "../../institutional/components/ui/TextSpanWrapper2";
import { buildOwnAvatarUrl } from "../../server/profiles/avatar-validation";
import { getMyProfile } from "../../server/profiles/operations";
import { removeProfileAvatarAction, saveBasicProfileAction, uploadProfileAvatarAction } from "./actions";
import { AvatarForm } from "./avatar-form";

export const metadata = { title: "Mi perfil" };

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

const statusMessages = new Map([
  ["saved", "Has actualizado tu perfil básico correctamente."],
  ["avatar_saved", "Has actualizado tu foto de perfil correctamente."],
  ["avatar_removed", "Has eliminado tu foto de perfil."],
]);

const errorMessages = new Map([
  ["email_immutable", "El correo institucional UC3M no se puede modificar tras el alta."],
  ["identity_immutable", "No se puede modificar el identificador ni el estado de la cuenta."],
  ["fields", "Completa nombre, apellidos, titulación y curso respetando los límites de longitud."],
  ["missing", "No se ha encontrado la cuenta asociada a esta sesión."],
  ["empty_file", "Selecciona una imagen válida antes de guardar."],
  ["file_too_large", "La imagen supera el límite máximo de 2 MB."],
  ["invalid_image", "Formato no admitido. Usa una imagen real en formato JPEG, PNG o WebP."],
  ["storage_unavailable", "El almacenamiento de fotos de perfil no está configurado todavía en este entorno."],
  ["storage_error", "No se pudo guardar la foto en este momento. Inténtalo de nuevo."],
]);

const profileLinks = [
  {
    href: "/profile/talent",
    icon: Folder01Icon,
    label: "Perfil de talento voluntario",
    description: "Añade de forma opcional formación, experiencia, habilidades, idiomas y enlaces externos.",
  },
  {
    href: "/profile/privacy",
    icon: SecurityCheckIcon,
    label: "Difusión y privacidad / Solicitud de supresión",
    description: "Gestiona tu decisión de difusión profesional y consulta o solicita la supresión de tu cuenta.",
  },
];

const fieldClass = "grid min-w-0 gap-1.5 font-bold";
const inlineLinkClass =
  "text-brand-primary underline underline-offset-[0.22em] transition-colors hover:text-brand-ink";

/**
 * Next.js ejecuta este Server Component para leer getMyProfile y preparar los formularios de datos
 * básicos y foto de perfil que invocan las acciones de cuenta.
 *
 * @param props - Propiedades de ruta suministradas por Next.js.
 * @param props.searchParams - Promesa con status y error que muestran el resultado del guardado.
 * @returns Perfil, gestión opcional de foto privada y formularios en JSX, o un aviso si falta la
 *   cuenta de la sesión.
 */
export default async function ProfilePage({ searchParams }) {
  const profile = await getMyProfile();
  const { status, error } = await searchParams;
  const errorMessage = typeof error === "string" ? errorMessages.get(error) : undefined;
  const statusMessage = typeof status === "string" ? statusMessages.get(status) : undefined;

  if (!profile) {
    return (
      <main className={pageClassName}>
        <PageHeading title="Mi perfil" />
        <p className={portalAlertClassName} role="alert">
          No se ha encontrado la cuenta asociada a esta sesión.
        </p>
      </main>
    );
  }

  const avatarUrl = buildOwnAvatarUrl(profile.avatarUpdatedAt);
  const hasAvatar = Boolean(avatarUrl);

  return (
    <main className={pageClassName}>
      <PageHeading
        title="Mi perfil"
        description="Actualiza tus datos básicos académicos. Tu correo UC3M permanece fijo para conservar tu identidad e historial en la comunidad."
        actions={<OrbitalMotif className="hidden h-12 w-24 text-brand-primary/60 sm:block" />}
      />

      <section
        className="flex flex-wrap items-center gap-4 rounded-lg border border-brand-line bg-brand-soft/45 px-5 py-4 sm:gap-6 sm:px-6"
        aria-label="Resumen de identidad universitaria"
      >
        <ProfileAvatar
          size="lg"
          src={avatarUrl}
          firstName={profile.firstName}
          lastName={profile.lastName}
        />
        <span aria-hidden="true" className="hidden h-10 w-px bg-brand-ink/40 sm:block" />
        <div className="grid min-w-0 gap-0.5">
          <p className="font-serif text-xl font-bold text-brand-ink sm:text-2xl">
            {profile.firstName} {profile.lastName}
          </p>
          <p className="font-serif text-[0.98rem] italic text-brand-ink">
            Correo UC3M verificado · {profile.email}
          </p>
        </div>
      </section>

      {statusMessage && (
        <p className={portalFeedbackClassName} role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className={portalAlertClassName} role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className={portalPanelClassName + " md:p-6"}>
          <h2 className="flex items-center gap-2 border-b border-brand-line pb-2.5">
            <HugeiconsIcon icon={User03Icon} size={21} aria-hidden="true" className="shrink-0 text-brand-primary" />
            <TextSpanWrapper2 as="span" className="min-w-0">
              Datos básicos
            </TextSpanWrapper2>
          </h2>
          <form
            key={`${profile.firstName}|${profile.lastName}|${profile.degree}|${profile.course}|${profile.academicLevel ?? ""}|${profile.languageModality ?? ""}`}
            action={saveBasicProfileAction}
            className="grid min-w-0 gap-4 sm:grid-cols-2"
          >
            <label className={fieldClass + " sm:col-span-2"}>
              Correo UC3M (solo lectura)
              <input
                name="email"
                type="email"
                defaultValue={profile.email}
                readOnly
                aria-readonly="true"
                aria-describedby="email-immutable-help"
                className={`${inputClass} read-only:bg-brand-panel`}
              />
            </label>
            <p id="email-immutable-help" className={portalFeedbackClassName + " sm:col-span-2"}>
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

            <div className="sm:col-span-2">
              <button type="submit" className={primaryButtonClass}>Guardar cambios</button>
            </div>
          </form>

          {profile.privacyVersion && (
            <p className="border-t border-brand-line pt-3 text-[0.95rem]">
              Aviso de privacidad aceptado: versión{" "}
              <code className="rounded bg-brand-panel px-1.5 py-0.5 font-mono text-[0.9em]">
                {profile.privacyVersion}
              </code>
              {profile.privacyAcceptedAt
                ? ` el ${dateFormat.format(new Date(profile.privacyAcceptedAt))}`
                : ""}
              . <Link href="/privacy" className={inlineLinkClass}>Consultar aviso de privacidad</Link>.
            </p>
          )}
        </section>

        <div className="grid min-w-0 gap-6">
          <section className={portalPanelClassName + " md:p-6"} aria-label="Foto de perfil">
            <h2 className="border-b border-brand-line pb-2.5">
              <TextSpanWrapper2 as="span" className="min-w-0">
                Foto de perfil
              </TextSpanWrapper2>
            </h2>
            <AvatarForm
              key={avatarUrl ?? "none"}
              currentAvatarUrl={avatarUrl}
              firstName={profile.firstName}
              lastName={profile.lastName}
              hasAvatar={hasAvatar}
              uploadAction={uploadProfileAvatarAction}
              removeAction={removeProfileAvatarAction}
            />
          </section>

          <nav className="grid gap-4 rounded-lg border border-brand-line bg-brand-panel p-5 md:p-6" aria-label="Opciones de perfil y privacidad">
          <h2 className="flex items-center gap-2 border-b border-brand-line pb-2.5">
            <HugeiconsIcon icon={Settings02Icon} size={21} aria-hidden="true" className="shrink-0 text-brand-primary" />
            <TextSpanWrapper2 as="span" className="min-w-0">
              Configuración de la cuenta
            </TextSpanWrapper2>
          </h2>
          <ul className="m-0 grid list-none gap-3 p-0">
            {profileLinks.map(({ href, label, description, icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[4px] border border-brand-line bg-brand-surface px-3.5 py-3.5 text-brand-ink no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft/20"
                >
                  <HugeiconsIcon icon={icon} size={20} aria-hidden="true" className="text-brand-primary" />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-[1.12rem] font-bold text-brand-primary underline underline-offset-[0.22em]">
                      {label}
                    </span>
                    <span className="text-[0.95rem]">{description}</span>
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
        </div>
      </div>
    </main>
  );
}
