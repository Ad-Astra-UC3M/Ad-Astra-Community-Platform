import { notFound } from "next/navigation";
import { BackLink } from "../../../../components/back-link";
import { getTalentForConsultation } from "../../../../server/profiles/operations";

export const metadata = { title: "Detalle de perfil de talento" };

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

const linkKindLabels = {
  cv: "CV",
  linkedin: "LinkedIn",
  github: "GitHub",
  portfolio: "Portfolio",
  other: "Otro enlace",
};

const experienceKindLabels = {
  team: "Equipo",
  project: "Proyecto",
  work: "Experiencia laboral",
};

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";

export default async function AdminTalentDetailPage({ params }) {
  const { id } = await params;
  const profile = await getTalentForConsultation(id);
  if (!profile) notFound();

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/admin/talent">Volver a consulta de talento</BackLink>
      <header className="grid min-w-0 gap-4">
        <p className="text-[0.9rem] font-bold text-brand-primary">
          Consulta de talento · {profile.disseminationGranted ? "Difusión autorizada" : "Sin autorización de difusión"}
        </p>
        <h1>{profile.name}</h1>
        {profile.headline && <p className="max-w-[48ch] text-[1.2rem] leading-[1.55]">{profile.headline}</p>}
        <p>
          {profile.email}
          {profile.degree ? ` · ${profile.degree}` : ""}
          {profile.course ? ` (${profile.course})` : ""}
        </p>
      </header>

      <section className={panelClass}>
        <h2>Formación y trayectoria</h2>
        <p>
          Universidad: {profile.university || "No indicada"}
          {profile.expectedGraduationYear ? ` · Año previsto de graduación: ${profile.expectedGraduationYear}` : ""}
        </p>
        <p>
          Preferencia de difusión:{" "}
          <strong>{profile.disseminationGranted ? "Autorizada" : "No autorizada"}</strong>
          {profile.disseminationDecidedAt
            ? ` (registrada el ${dateFormat.format(new Date(profile.disseminationDecidedAt))}, versión ${profile.disseminationPolicyVersion ?? "vigente"}${
                profile.disseminationValidUntil
                  ? `, válida hasta el ${dateFormat.format(new Date(profile.disseminationValidUntil))}`
                  : ""
              })`
            : ""}
        </p>
        {profile.experiences.length > 0 && (
          <div className="grid min-w-0 gap-3">
            <h3>Experiencias y proyectos ({profile.experiences.length})</h3>
            <ul className="grid list-disc gap-2 pl-6">
              {profile.experiences.map((exp, index) => (
                <li key={`${exp.kind}-${exp.title}-${index}`}>
                  <strong>{experienceKindLabels[exp.kind] ?? exp.kind}</strong>: {exp.title}
                  {exp.organization ? ` (${exp.organization})` : ""}
                  {exp.isFeatured ? " · Destacado" : ""}
                  {exp.description ? ` — ${exp.description}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={panelClass}>
        <h2>Competencias e intereses</h2>
        <p>Habilidades: {profile.skills.length ? profile.skills.join(", ") : "Sin especificar"}</p>
        <p>Herramientas: {profile.tools.length ? profile.tools.join(", ") : "Sin especificar"}</p>
        <p>Intereses: {profile.interests.length ? profile.interests.join(", ") : "Sin especificar"}</p>
        <p>Sectores: {profile.sectors.length ? profile.sectors.join(", ") : "Sin especificar"}</p>
        <p>
          Tipos de oportunidad:{" "}
          {profile.opportunityTypes.length ? profile.opportunityTypes.join(", ") : "Sin especificar"}
        </p>
        <p>
          Idiomas:{" "}
          {profile.languages.length
            ? profile.languages.map((lang) => `${lang.language} (${lang.level})`).join(", ")
            : "Sin especificar"}
        </p>
      </section>

      <section className={panelClass}>
        <h2>Enlaces profesionales ({profile.links.length})</h2>
        {profile.links.length > 0 ? (
          <ul className="grid list-disc gap-1.5 pl-6">
            {profile.links.map((link, index) => (
              <li key={`${link.kind}-${index}`}>
                <strong>{linkKindLabels[link.kind] ?? link.kind}</strong>:{" "}
                <a
                  className="text-brand-primary underline underline-offset-[0.22em] hover:text-brand-ink"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p>Este perfil no incluye enlaces profesionales.</p>
        )}
      </section>
    </main>
  );
}
