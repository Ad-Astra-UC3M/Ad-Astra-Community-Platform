import { BackLink } from "../../../components/back-link";
import { getTalentProfile } from "../../../demo/profile";
import { requireUser } from "../../../demo/session";
import { saveTalentProfileAction } from "../actions";

export const metadata = { title: "Perfil de talento voluntario" };

const errorMessages = new Map([
  ["invalid_year", "Introduce un año de graduación válido de cuatro cifras (entre 1950 y 2100) o déjalo vacío."],
  ["invalid_url", "Todos los enlaces deben ser direcciones web válidas que empiecen por http:// o https://."],
  ["invalid_link_kind", "El tipo de enlace indicado no es válido."],
  ["fields", "Revisa la longitud de los campos y las etiquetas (máximo 20 por categoría)."],
  ["missing", "No se ha encontrado la cuenta asociada a esta sesión."],
]);

function firstLinkByKind(links, kind) {
  return links.find((link) => link.kind === kind);
}

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

const fieldClass = "grid min-w-0 gap-1.5 font-bold";

const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";

const textareaClass = `${inputClass} resize-y`;

const noticeClass = "rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink";

const alertClass = "rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink";

const sectionHeadingClass = "font-display text-[1.25rem] leading-[1.22] font-normal uppercase";

const codeClass = "rounded bg-brand-soft/20 px-1.5 py-0.5 font-mono text-[0.9em]";

export default async function TalentProfilePage({ searchParams }) {
  const user = await requireUser("/profile/talent");
  const profile = getTalentProfile(user.workspaceId, user.id, user.id);
  const { status, error } = await searchParams;
  const errorMessage = typeof error === "string" ? errorMessages.get(error) : undefined;
  const saved = status === "saved";

  if (!profile) {
    return (
      <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
        <BackLink href="/profile">Volver a mi perfil</BackLink>
        <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-primary md:text-[2.5rem]">
          Perfil de talento voluntario
        </h1>
        <p className={alertClass} role="alert">No tienes acceso a este perfil.</p>
      </main>
    );
  }

  const cvLink = firstLinkByKind(profile.links, "cv");
  const linkedinLink = firstLinkByKind(profile.links, "linkedin");
  const githubLink = firstLinkByKind(profile.links, "github");
  const portfolioLink = firstLinkByKind(profile.links, "portfolio");
  const otherLink = firstLinkByKind(profile.links, "other");

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/profile">Volver a mi perfil</BackLink>
      <p className="text-[0.9rem] font-bold text-brand-primary">Perfil voluntario y privado</p>
      <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-primary md:text-[2.5rem]">
        Perfil de talento voluntario
      </h1>
      <p className="max-w-[48ch] text-[1.2rem] leading-relaxed">
        Completa solo los apartados que quieras compartir en futuras iniciativas de talento. Puedes
        dejar cualquier campo vacío o retirar tus enlaces cuando lo prefieras.
      </p>

      <p className={noticeClass}>
        No se suben archivos a la plataforma. Si incluyes enlaces externos a tu CV, LinkedIn, GitHub o
        portfolio, el acceso al contenido depende siempre del servicio externo donde esté alojado.
      </p>

      {saved && (
        <p className={noticeClass} role="status">
          Has guardado tu perfil de talento voluntario.
        </p>
      )}
      {errorMessage && (
        <p className={alertClass} role="alert">
          {errorMessage}
        </p>
      )}

      <section className={panelClass}>
        <form key={profile.updatedAt ?? "empty"} action={saveTalentProfileAction} className="grid min-w-0 gap-4">
          <h2 className={sectionHeadingClass}>Formación y trayectoria</h2>

          <label className={fieldClass}>
            Universidad
            <input
              name="university"
              defaultValue={profile.university}
              placeholder="Universidad Carlos III de Madrid"
              maxLength={120}
              className={inputClass}
            />
          </label>

          <label className={fieldClass}>
            Año de graduación estimado
            <input
              name="graduationYear"
              type="text"
              inputMode="numeric"
              defaultValue={profile.graduationYear ?? ""}
              placeholder="2027"
              maxLength={4}
              className={inputClass}
            />
          </label>

          <label className={fieldClass}>
            Titular breve
            <input
              name="headline"
              defaultValue={profile.headline}
              placeholder="Ej.: Estudiante de aviónica y sistemas embebidos"
              maxLength={160}
              className={inputClass}
            />
          </label>

          <label className={fieldClass}>
            Resumen de experiencia
            <textarea
              name="experiencesSummary"
              rows={4}
              defaultValue={profile.experiencesSummary}
              placeholder="Prácticas, proyectos de asociación, docencia o experiencia relevante."
              maxLength={2000}
              className={textareaClass}
            />
          </label>

          <label className={fieldClass}>
            Proyecto destacado
            <textarea
              name="featuredProject"
              rows={3}
              defaultValue={profile.featuredProject}
              placeholder="Describe brevemente un proyecto técnico o académico del que estés orgulloso/a."
              maxLength={1000}
              className={textareaClass}
            />
          </label>

          <h2 className={sectionHeadingClass}>Etiquetas e idiomas</h2>
          <p>Separa varias entradas con comas.</p>

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
            Idiomas
            <input
              name="languages"
              defaultValue={profile.languages.join(", ")}
              placeholder="Español (nativo), Inglés (C1)"
              className={inputClass}
            />
          </label>

          <h2 className={sectionHeadingClass}>Enlaces externos</h2>
          <p>
            Solo se aceptan direcciones <code className={codeClass}>http://</code> o{" "}
            <code className={codeClass}>https://</code>. Borra una dirección y guarda para retirar
            ese enlace.
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

          <div>
            <button type="submit" className={primaryButtonClass}>Guardar perfil de talento</button>
          </div>
        </form>
      </section>

      {profile.links.length > 0 && (
        <section className={panelClass}>
          <h2 className={sectionHeadingClass}>Enlaces guardados</h2>
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
    </main>
  );
}
