/**
 * @file Ruta `/profile/talent` del App Router. Muestra el formulario voluntario de talento del usuario
 * y adapta las listas persistidas a controles de texto editables.
 */

import { Folder01Icon, LinkSquare02Icon, User03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { BackLink } from "../../../components/back-link";
import { inputClass, primaryButtonClass } from "../../../components/form-styles";
import { PageHeading, pageClassName } from "../../../components/page-layout";
import { portalAlertClassName, portalFeedbackClassName, portalPanelClassName } from "../../../components/portal-ui";
import AnimatedWordmark from "../../../institutional/components/brand/AnimatedWordmark";
import TextSpanWrapper2 from "../../../institutional/components/ui/TextSpanWrapper2";
import { getMyTalentProfile } from "../../../server/profiles/operations";
import { saveTalentProfileAction } from "../actions";

export const metadata = { title: "Perfil de talento voluntario" };

const errorMessages = new Map([
  ["invalid_year", "Introduce un año de graduación válido de cuatro cifras (entre 1950 y 2100) o déjalo vacío."],
  ["invalid_url", "Todos los enlaces deben ser direcciones web válidas que empiecen por http:// o https://."],
  ["invalid_link_kind", "El tipo de enlace indicado no es válido."],
  ["invalid_experiences", "Revisa el formato y la longitud de las experiencias indicadas."],
  ["invalid_languages", "Revisa el formato de los idiomas introducidos (por ejemplo, Español (nativo), Inglés (C1))."],
  ["duplicate_language", "No repitas el mismo idioma en la lista de idiomas."],
  ["fields", "Revisa la longitud de los campos y las etiquetas (máximo 20 por categoría)."],
  ["missing", "No se ha encontrado la cuenta asociada a esta sesión."],
]);

/**
 * Busca el primer enlace de un tipo para rellenar su campo en TalentProfilePage.
 *
 * @param links - Enlaces del perfil en su orden guardado.
 * @param kind - Tipo de enlace que corresponde al control del formulario.
 * @returns Primer enlace con ese tipo o undefined si no existe.
 */
function firstLinkByKind(links, kind) {
  return links.find((link) => link.kind === kind);
}

/**
 * Prepara el valor inicial del proyecto destacado para TalentProfilePage.
 *
 * @param experiences - Experiencias entre las que se busca la primera marcada como destacada.
 * @returns Descripción o título de la experiencia destacada, o cadena vacía si falta.
 */
function formatFeaturedProject(experiences) {
  const featured = experiences.find((item) => item.isFeatured);
  if (!featured) return "";
  return featured.description ?? featured.title;
}

/**
 * Prepara el valor inicial del resumen libre para TalentProfilePage.
 *
 * @param experiences - Experiencias del perfil de las que se toman las que no están destacadas.
 * @returns Texto de experiencias ordinarias separado por líneas en blanco.
 */
function formatExperiencesSummary(experiences) {
  return experiences
    .filter((item) => !item.isFeatured)
    .map((item) => {
      if (item.title === "Resumen de experiencia" && item.description) {
        return item.description;
      }
      const header = item.organization ? `${item.title} (${item.organization})` : item.title;
      return item.description ? `${header}: ${item.description}` : header;
    })
    .join("\n\n");
}

/**
 * Prepara el campo de idiomas que renderiza TalentProfilePage.
 *
 * @param languages - Pares de idioma y nivel guardados en el perfil.
 * @returns Idiomas separados por comas, con el nivel entre paréntesis cuando es específico.
 */
function formatLanguages(languages) {
  return languages
    .map((entry) =>
      entry.level && entry.level !== "No especificado"
        ? `${entry.language} (${entry.level})`
        : entry.language,
    )
    .join(", ");
}

const fieldClass = "grid min-w-0 gap-1.5 font-bold";
const textareaClass = `${inputClass} min-h-[5.75rem] resize-y`;
const sectionHeadingClass = "flex items-center gap-2 border-b border-brand-line pb-2 text-[1.15rem] sm:col-span-2";
const codeClass = "rounded bg-brand-panel px-1.5 py-0.5 font-mono text-[0.9em]";

/**
 * Next.js ejecuta este Server Component para leer getMyTalentProfile y rellenar el formulario
 * de saveTalentProfileAction.
 *
 * @param props - Propiedades de ruta suministradas por Next.js.
 * @param props.searchParams - Promesa con status y error para el mensaje del guardado.
 * @returns Formulario de talento en JSX, o aviso cuando falta el perfil básico.
 */
export default async function TalentProfilePage({ searchParams }) {
  const profile = await getMyTalentProfile();
  const { status, error } = await searchParams;
  const errorMessage = typeof error === "string" ? errorMessages.get(error) : undefined;
  const saved = status === "saved";

  if (!profile) {
    return (
      <main className={pageClassName}>
        <BackLink href="/profile">Volver a mi perfil</BackLink>
        <PageHeading title="Perfil de talento voluntario" />
        <p className={portalAlertClassName} role="alert">No tienes acceso a este perfil.</p>
      </main>
    );
  }

  const cvLink = firstLinkByKind(profile.links, "cv");
  const linkedinLink = firstLinkByKind(profile.links, "linkedin");
  const githubLink = firstLinkByKind(profile.links, "github");
  const portfolioLink = firstLinkByKind(profile.links, "portfolio");
  const otherLink = firstLinkByKind(profile.links, "other");
  const featuredProject = formatFeaturedProject(profile.experiences);
  const experiencesSummary = formatExperiencesSummary(profile.experiences);
  const formattedLanguages = formatLanguages(profile.languages);
  const formKey = profile.updatedAt ? new Date(profile.updatedAt).toISOString() : "empty";

  return (
    <main className={pageClassName}>
      <BackLink href="/profile">Volver a mi perfil</BackLink>
      <PageHeading
        eyebrow="Perfil voluntario y privado"
        title="Perfil de talento voluntario"
        description="Completa solo los apartados que quieras compartir en futuras iniciativas de talento. Puedes dejar cualquier campo vacío o retirar tus enlaces cuando lo prefieras."
      />

      {saved && (
        <p className={portalFeedbackClassName} role="status">
          Has guardado tu perfil de talento voluntario.
        </p>
      )}
      {errorMessage && (
        <p className={portalAlertClassName} role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,0.34fr)_minmax(0,1fr)]">
        <aside className="grid gap-4 lg:border-e lg:border-brand-line lg:pe-6">
          <p className="font-serif text-2xl leading-tight font-bold text-brand-ink">
            Tu trayectoria aeroespacial, en un solo perfil.
          </p>
          <p className="text-[0.98rem] leading-relaxed">
            Presenta tu formación, experiencias, proyectos, habilidades e intereses para conectar con el ecosistema de{" "}
            <AnimatedWordmark inline ariaLabel="Ad Astra" className="mx-0.5 h-[0.76em] align-[-0.05em]" />{" "}
            UC3M.
          </p>
          <p className={portalFeedbackClassName}>
            No se suben archivos a la plataforma. Si incluyes enlaces externos a tu CV, LinkedIn, GitHub o portfolio, el acceso al contenido depende siempre del servicio externo donde esté alojado.
          </p>
        </aside>

        <div className="grid min-w-0 gap-6">
          <section className={portalPanelClassName + " md:p-7"}>
            <form key={formKey} action={saveTalentProfileAction} className="grid min-w-0 gap-4 sm:grid-cols-2">
              <h2 className={sectionHeadingClass}>
                <HugeiconsIcon icon={User03Icon} size={20} aria-hidden="true" className="shrink-0 text-brand-primary" />
                <TextSpanWrapper2 as="span" className="min-w-0">
                  Formación y trayectoria
                </TextSpanWrapper2>
              </h2>

              <label className={fieldClass}>
                Universidad
                <input
                  name="university"
                  defaultValue={profile.university}
                  placeholder="Universidad Carlos III de Madrid"
                  maxLength={160}
                  className={inputClass}
                />
              </label>

              <label className={fieldClass}>
                Año de graduación estimado
                <input
                  name="graduationYear"
                  type="text"
                  inputMode="numeric"
                  defaultValue={profile.expectedGraduationYear ?? ""}
                  placeholder="2027"
                  maxLength={4}
                  className={inputClass}
                />
              </label>

              <label className={fieldClass + " sm:col-span-2"}>
                Titular breve
                <input
                  name="headline"
                  defaultValue={profile.headline}
                  placeholder="Ej.: Estudiante de aviónica y sistemas embebidos"
                  maxLength={200}
                  className={inputClass}
                />
              </label>

              <label className={fieldClass}>
                Resumen de experiencia
                <textarea
                  name="experiencesSummary"
                  rows={4}
                  defaultValue={experiencesSummary}
                  placeholder="Prácticas, proyectos de asociación, docencia o experiencia relevante."
                  maxLength={2000}
                  className={textareaClass}
                />
              </label>

              <label className={fieldClass}>
                Proyecto destacado
                <textarea
                  name="featuredProject"
                  rows={4}
                  defaultValue={featuredProject}
                  placeholder="Describe brevemente un proyecto técnico o académico del que estés orgulloso/a."
                  maxLength={2000}
                  className={textareaClass}
                />
              </label>

              <h2 className={sectionHeadingClass + " mt-2"}>
                <HugeiconsIcon icon={Folder01Icon} size={20} aria-hidden="true" className="shrink-0 text-brand-primary" />
                <TextSpanWrapper2 as="span" className="min-w-0">
                  Etiquetas e idiomas
                </TextSpanWrapper2>
              </h2>
              <p className="text-[0.95rem] sm:col-span-2">Separa varias entradas con comas.</p>

              <label className={fieldClass}>
                Habilidades
                <input
                  name="skills"
                  defaultValue={profile.skills.join(", ")}
                  placeholder="C++, Python, diseño estructural"
                  className={inputClass}
                />
              </label>

              <label className={fieldClass}>
                Herramientas
                <input
                  name="tools"
                  defaultValue={profile.tools.join(", ")}
                  placeholder="MATLAB, KiCad, Git"
                  className={inputClass}
                />
              </label>

              <label className={fieldClass}>
                Intereses
                <input
                  name="interests"
                  defaultValue={profile.interests.join(", ")}
                  placeholder="Satélites pequeños, propulsión, control de vuelo"
                  className={inputClass}
                />
              </label>

              <label className={fieldClass}>
                Sectores
                <input
                  name="sectors"
                  defaultValue={profile.sectors.join(", ")}
                  placeholder="Aeroespacial, robótica, energía"
                  className={inputClass}
                />
              </label>

              <label className={fieldClass}>
                Tipos de oportunidad
                <input
                  name="opportunityTypes"
                  defaultValue={profile.opportunityTypes.join(", ")}
                  placeholder="Prácticas, investigación, TFG/TFM"
                  className={inputClass}
                />
              </label>

              <label className={fieldClass}>
                Idiomas
                <input
                  name="languages"
                  defaultValue={formattedLanguages}
                  placeholder="Español (nativo), Inglés (C1)"
                  className={inputClass}
                />
              </label>

              <h2 className={sectionHeadingClass + " mt-2"}>
                <HugeiconsIcon icon={LinkSquare02Icon} size={20} aria-hidden="true" className="shrink-0 text-brand-primary" />
                <TextSpanWrapper2 as="span" className="min-w-0">
                  Enlaces externos
                </TextSpanWrapper2>
              </h2>
              <p className="text-[0.95rem] sm:col-span-2">
                Solo se aceptan direcciones <code className={codeClass}>http://</code> o{" "}
                <code className={codeClass}>https://</code>. Borra una dirección y guarda para retirar ese enlace.
              </p>

              <label className={fieldClass}>
                Enlace a CV (URL externa)
                <input
                  name="linkCvUrl"
                  type="text"
                  inputMode="url"
                  defaultValue={cvLink?.url ?? ""}
                  placeholder="https://..."
                  maxLength={2048}
                  className={inputClass}
                />
              </label>

              <label className={fieldClass}>
                LinkedIn
                <input
                  name="linkLinkedinUrl"
                  type="text"
                  inputMode="url"
                  defaultValue={linkedinLink?.url ?? ""}
                  placeholder="https://www.linkedin.com/in/..."
                  maxLength={2048}
                  className={inputClass}
                />
              </label>

              <label className={fieldClass}>
                GitHub
                <input
                  name="linkGithubUrl"
                  type="text"
                  inputMode="url"
                  defaultValue={githubLink?.url ?? ""}
                  placeholder="https://github.com/..."
                  maxLength={2048}
                  className={inputClass}
                />
              </label>

              <label className={fieldClass}>
                Portfolio
                <input
                  name="linkPortfolioUrl"
                  type="text"
                  inputMode="url"
                  defaultValue={portfolioLink?.url ?? ""}
                  placeholder="https://..."
                  maxLength={2048}
                  className={inputClass}
                />
              </label>

              <label className={fieldClass}>
                Otro enlace · Etiqueta
                <input
                  name="linkOtherLabel"
                  defaultValue={otherLink?.label ?? ""}
                  placeholder="Publicación, web personal..."
                  maxLength={80}
                  className={inputClass}
                />
              </label>

              <label className={fieldClass}>
                Otro enlace · URL
                <input
                  name="linkOtherUrl"
                  type="text"
                  inputMode="url"
                  defaultValue={otherLink?.url ?? ""}
                  placeholder="https://..."
                  maxLength={2048}
                  className={inputClass}
                />
              </label>

              <div className="pt-2 sm:col-span-2">
                <button type="submit" className={primaryButtonClass}>Guardar perfil de talento</button>
              </div>
            </form>
          </section>

          {profile.links.length > 0 && (
            <section className={portalPanelClassName + " md:p-7"}>
              <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2 text-[1.15rem]">
                Enlaces guardados
              </TextSpanWrapper2>
              <ul className="grid list-disc gap-2 pl-5">
                {profile.links.map((link, index) => (
                  <li key={`${link.kind}-${index}`}>
                    <strong>{link.label}:</strong>{" "}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-brand-primary underline underline-offset-[0.22em] transition-colors hover:text-brand-ink"
                    >
                      {link.url}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
