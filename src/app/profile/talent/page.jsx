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

export default async function TalentProfilePage({ searchParams }) {
  const user = await requireUser("/profile/talent");
  const profile = getTalentProfile(user.workspaceId, user.id, user.id);
  const { status, error } = await searchParams;
  const errorMessage = typeof error === "string" ? errorMessages.get(error) : undefined;
  const saved = status === "saved";

  if (!profile) {
    return (
      <main className="shell stack">
        <BackLink href="/profile">Volver a mi perfil</BackLink>
        <h1>Perfil de talento voluntario</h1>
        <p className="notice" role="alert">No tienes acceso a este perfil.</p>
      </main>
    );
  }

  const cvLink = firstLinkByKind(profile.links, "cv");
  const linkedinLink = firstLinkByKind(profile.links, "linkedin");
  const githubLink = firstLinkByKind(profile.links, "github");
  const portfolioLink = firstLinkByKind(profile.links, "portfolio");
  const otherLink = firstLinkByKind(profile.links, "other");

  return (
    <main className="shell stack">
      <BackLink href="/profile">Volver a mi perfil</BackLink>
      <p className="eyebrow">Perfil voluntario y privado</p>
      <h1>Perfil de talento voluntario</h1>
      <p className="lead">
        Completa solo los apartados que quieras compartir en futuras iniciativas de talento. Puedes
        dejar cualquier campo vacío o retirar tus enlaces cuando lo prefieras.
      </p>

      <p className="notice">
        No se suben archivos a la plataforma. Si incluyes enlaces externos a tu CV, LinkedIn, GitHub o
        portfolio, el acceso al contenido depende siempre del servicio externo donde esté alojado.
      </p>

      {saved && (
        <p className="notice" role="status">
          Has guardado tu perfil de talento voluntario.
        </p>
      )}
      {errorMessage && (
        <p className="notice" role="alert">
          {errorMessage}
        </p>
      )}

      <section className="panel stack">
        <form key={profile.updatedAt ?? "empty"} action={saveTalentProfileAction} className="stack">
          <h2>Formación y trayectoria</h2>

          <label className="field">
            Universidad
            <input
              name="university"
              defaultValue={profile.university}
              placeholder="Universidad Carlos III de Madrid"
              maxLength={120}
            />
          </label>

          <label className="field">
            Año de graduación estimado
            <input
              name="graduationYear"
              type="text"
              inputMode="numeric"
              defaultValue={profile.graduationYear ?? ""}
              placeholder="2027"
              maxLength={4}
            />
          </label>

          <label className="field">
            Titular breve
            <input
              name="headline"
              defaultValue={profile.headline}
              placeholder="Ej.: Estudiante de aviónica y sistemas embebidos"
              maxLength={160}
            />
          </label>

          <label className="field">
            Resumen de experiencia
            <textarea
              name="experiencesSummary"
              rows={4}
              defaultValue={profile.experiencesSummary}
              placeholder="Prácticas, proyectos de asociación, docencia o experiencia relevante."
              maxLength={2000}
            />
          </label>

          <label className="field">
            Proyecto destacado
            <textarea
              name="featuredProject"
              rows={3}
              defaultValue={profile.featuredProject}
              placeholder="Describe brevemente un proyecto técnico o académico del que estés orgulloso/a."
              maxLength={1000}
            />
          </label>

          <h2>Etiquetas e idiomas</h2>
          <p>Separa varias entradas con comas.</p>

          <label className="field">
            Habilidades
            <input
              name="skills"
              defaultValue={profile.skills.join(", ")}
              placeholder="C++, Python, diseño estructural"
            />
          </label>

          <label className="field">
            Herramientas
            <input
              name="tools"
              defaultValue={profile.tools.join(", ")}
              placeholder="MATLAB, KiCad, Git"
            />
          </label>

          <label className="field">
            Intereses
            <input
              name="interests"
              defaultValue={profile.interests.join(", ")}
              placeholder="Satélites pequeños, propulsión, control de vuelo"
            />
          </label>

          <label className="field">
            Sectores
            <input
              name="sectors"
              defaultValue={profile.sectors.join(", ")}
              placeholder="Aeroespacial, robótica, energía"
            />
          </label>

          <label className="field">
            Idiomas
            <input
              name="languages"
              defaultValue={profile.languages.join(", ")}
              placeholder="Español (nativo), Inglés (C1)"
            />
          </label>

          <h2>Enlaces externos</h2>
          <p>
            Solo se aceptan direcciones <code>http://</code> o <code>https://</code>. Borra una
            dirección y guarda para retirar ese enlace.
          </p>

          <label className="field">
            Enlace a CV (URL externa)
            <input
              name="linkCvUrl"
              type="text"
              inputMode="url"
              defaultValue={cvLink?.url ?? ""}
              placeholder="https://..."
              maxLength={2048}
            />
          </label>

          <label className="field">
            LinkedIn
            <input
              name="linkLinkedinUrl"
              type="text"
              inputMode="url"
              defaultValue={linkedinLink?.url ?? ""}
              placeholder="https://www.linkedin.com/in/..."
              maxLength={2048}
            />
          </label>

          <label className="field">
            GitHub
            <input
              name="linkGithubUrl"
              type="text"
              inputMode="url"
              defaultValue={githubLink?.url ?? ""}
              placeholder="https://github.com/..."
              maxLength={2048}
            />
          </label>

          <label className="field">
            Portfolio
            <input
              name="linkPortfolioUrl"
              type="text"
              inputMode="url"
              defaultValue={portfolioLink?.url ?? ""}
              placeholder="https://..."
              maxLength={2048}
            />
          </label>

          <label className="field">
            Otro enlace · Etiqueta
            <input
              name="linkOtherLabel"
              defaultValue={otherLink?.label ?? ""}
              placeholder="Publicación, web personal..."
              maxLength={80}
            />
          </label>

          <label className="field">
            Otro enlace · URL
            <input
              name="linkOtherUrl"
              type="text"
              inputMode="url"
              defaultValue={otherLink?.url ?? ""}
              placeholder="https://..."
              maxLength={2048}
            />
          </label>

          <div>
            <button type="submit" className="button">Guardar perfil de talento</button>
          </div>
        </form>
      </section>

      {profile.links.length > 0 && (
        <section className="panel stack">
          <h2>Enlaces guardados</h2>
          <ul>
            {profile.links.map((link, index) => (
              <li key={`${link.kind}-${index}`}>
                <strong>{link.label}:</strong>{" "}
                <a href={link.url} target="_blank" rel="noopener noreferrer">
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
