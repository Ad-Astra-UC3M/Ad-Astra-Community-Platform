/**
 * @file Ruta dinámica `/admin/talent/[id]`. Presenta la ficha interna de talento, con sus datos
 * profesionales, enlaces e indicador de difusión.
 */

import { notFound } from "next/navigation";
import { BackLink } from "../../../../components/back-link";
import { PageHeading, pageClassName } from "../../../../components/page-layout";
import { portalPanelClassName } from "../../../../components/portal-ui";
import { ProfileAvatar } from "../../../../components/profile-avatar";
import TextSpanWrapper2 from "../../../../institutional/components/ui/TextSpanWrapper2";
import { buildTalentAvatarUrl } from "../../../../server/profiles/avatar-validation";
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

/**
 * Next.js ejecuta este Server Component para consultar getTalentForConsultation. Llama a
 * notFound cuando falta la ficha.
 *
 * @param props - Propiedades de ruta suministradas por Next.js.
 * @param props.params - Promesa con el UUID del perfil de talento solicitado.
 * @returns Ficha interna en JSX para la capacidad talent_consultation, o la vista 404 si falta
 *   el perfil.
 */
export default async function AdminTalentDetailPage({ params }) {
  const { id } = await params;
  const profile = await getTalentForConsultation(id);
  if (!profile) notFound();

  return (
    <main className={pageClassName}>
      <BackLink href="/admin/talent">Volver a consulta de talento</BackLink>
      <PageHeading
        eyebrow={`Consulta de talento · ${profile.disseminationGranted ? "Difusión autorizada" : "Sin autorización de difusión"}`}
        title={profile.name}
        description={
          profile.headline
            ? `${profile.headline} — ${profile.email}${profile.degree ? ` · ${profile.degree}` : ""}${profile.course ? ` (${profile.course})` : ""}`
            : `${profile.email}${profile.degree ? ` · ${profile.degree}` : ""}${profile.course ? ` (${profile.course})` : ""}`
        }
        actions={
          <ProfileAvatar
            size="md"
            src={buildTalentAvatarUrl(profile.personId, profile.avatarUpdatedAt)}
            name={profile.name}
          />
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className={portalPanelClassName}>
          <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
            Formación y trayectoria
          </TextSpanWrapper2>
          <dl className="grid gap-3">
            <div className="border-b border-brand-line pb-2">
              <dt className="font-bold">Universidad</dt>
              <dd>{profile.university || "No indicada"}</dd>
            </div>
            {profile.expectedGraduationYear && (
              <div className="border-b border-brand-line pb-2">
                <dt className="font-bold">Graduación prevista</dt>
                <dd>{profile.expectedGraduationYear}</dd>
              </div>
            )}
            <div className="border-b border-brand-line pb-2">
              <dt className="font-bold">Preferencia de difusión</dt>
              <dd>
                <strong>{profile.disseminationGranted ? "Autorizada" : "No autorizada"}</strong>
                {profile.disseminationDecidedAt
                  ? ` (registrada el ${dateFormat.format(new Date(profile.disseminationDecidedAt))}, versión ${profile.disseminationPolicyVersion ?? "vigente"}${
                      profile.disseminationValidUntil
                        ? `, válida hasta el ${dateFormat.format(new Date(profile.disseminationValidUntil))}`
                        : ""
                    })`
                  : ""}
              </dd>
            </div>
          </dl>
          {profile.experiences.length > 0 && (
            <div className="grid min-w-0 gap-2 pt-1">
              <h3 className="text-lg">Experiencias y proyectos ({profile.experiences.length})</h3>
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

        <section className={portalPanelClassName}>
          <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
            Competencias e intereses
          </TextSpanWrapper2>
          <dl className="grid gap-3">
            <div className="border-b border-brand-line pb-2">
              <dt className="font-bold">Habilidades</dt>
              <dd>{profile.skills.length ? profile.skills.join(", ") : "Sin especificar"}</dd>
            </div>
            <div className="border-b border-brand-line pb-2">
              <dt className="font-bold">Herramientas</dt>
              <dd>{profile.tools.length ? profile.tools.join(", ") : "Sin especificar"}</dd>
            </div>
            <div className="border-b border-brand-line pb-2">
              <dt className="font-bold">Intereses</dt>
              <dd>{profile.interests.length ? profile.interests.join(", ") : "Sin especificar"}</dd>
            </div>
            <div className="border-b border-brand-line pb-2">
              <dt className="font-bold">Sectores</dt>
              <dd>{profile.sectors.length ? profile.sectors.join(", ") : "Sin especificar"}</dd>
            </div>
            <div className="border-b border-brand-line pb-2">
              <dt className="font-bold">Tipos de oportunidad</dt>
              <dd>{profile.opportunityTypes.length ? profile.opportunityTypes.join(", ") : "Sin especificar"}</dd>
            </div>
            <div>
              <dt className="font-bold">Idiomas</dt>
              <dd>
                {profile.languages.length
                  ? profile.languages.map((lang) => `${lang.language} (${lang.level})`).join(", ")
                  : "Sin especificar"}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className={portalPanelClassName}>
        <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
          {`Enlaces profesionales (${profile.links.length})`}
        </TextSpanWrapper2>
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
