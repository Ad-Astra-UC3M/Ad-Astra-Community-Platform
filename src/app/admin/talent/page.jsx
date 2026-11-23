/**
 * @file Ruta `/admin/talent` del App Router. Permite consultar internamente perfiles de talento con
 * filtros de texto y etiquetas, e indica si su difusión está autorizada.
 */

import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../../components/form-styles";
import { PageHeading, pageClassName } from "../../../components/page-layout";
import { portalMutedPanelClassName, portalPanelClassName } from "../../../components/portal-ui";
import { ProfileAvatar } from "../../../components/profile-avatar";
import TextSpanWrapper2 from "../../../institutional/components/ui/TextSpanWrapper2";
import { buildTalentAvatarUrl } from "../../../server/profiles/avatar-validation";
import { searchTalentForConsultation } from "../../../server/profiles/operations";
import { AdminTable } from "../admin-table";

export const metadata = { title: "Consulta de talento" };

/**
 * Next.js ejecuta este Server Component para consultar searchTalentForConsultation con los
 * filtros de la URL.
 *
 * @param props - Propiedades de ruta suministradas por Next.js.
 * @param props.searchParams - Promesa con q para texto libre y tags para etiquetas separadas
 *   por comas.
 * @returns Buscador y resultados en JSX con enlaces a los perfiles de talento disponibles.
 */
export default async function AdminTalentPage({ searchParams }) {
  const resolved = await searchParams;
  const query = typeof resolved?.q === "string" ? resolved.q : "";
  const rawTags = typeof resolved?.tags === "string" ? resolved.tags : "";
  const tags = rawTags
    ? rawTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : undefined;
  const profiles = await searchTalentForConsultation({ query, tags });

  return (
    <main className={pageClassName}>
      <BackLink href="/admin">Volver al panel</BackLink>
      <PageHeading
        eyebrow="Consulta de talento"
        title="Perfiles voluntarios de talento"
        description="Acceso restringido exclusivamente a la capacidad de consulta de talento. Filtra por habilidades, herramientas, intereses, sectores o idiomas."
      />

      <section className={portalMutedPanelClassName} aria-label="Buscar perfiles de talento">
        <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
          Buscar perfiles
        </TextSpanWrapper2>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-0 flex-1 basis-56 gap-1.5 font-bold">
            Habilidades, herramientas, intereses o perfil
            <input
              className={inputClass}
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Ejemplo: Python, Simulink, propulsión, GNC"
            />
          </label>
          <button type="submit" className={primaryButtonClass}>Buscar</button>
          {query && <Link className={secondaryButtonClass} href="/admin/talent">Limpiar</Link>}
        </form>
      </section>

      <section className="grid min-w-0 gap-4" aria-label="Resultados de talento">
        <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
          {`Perfiles encontrados (${profiles.length})`}
        </TextSpanWrapper2>
        {profiles.length === 0 ? (
          <section className={portalPanelClassName}>
            <p>
              {query
                ? "No hay perfiles de talento que coincidan con esa búsqueda."
                : "Todavía no hay perfiles voluntarios de talento registrados."}
            </p>
          </section>
        ) : (
          <AdminTable label="Resultados de talento" headers={["Perfil", "Formación", "Competencias", "Difusión", "Acción"]}>
            {profiles.map((profile) => (
              <tr key={profile.personId}>
                <td>
                  <div className="flex items-center gap-3">
                    <ProfileAvatar
                      size="sm"
                      decorative
                      src={buildTalentAvatarUrl(profile.personId, profile.avatarUpdatedAt)}
                      name={profile.name}
                    />
                    <div className="min-w-0">
                      <strong>{profile.name}</strong>
                      {profile.headline && (
                        <>
                          <br />
                          <em>{profile.headline}</em>
                        </>
                      )}
                    </div>
                  </div>
                </td>
                <td>{[profile.degree, profile.course, profile.university, profile.expectedGraduationYear].filter(Boolean).join(" · ") || "Sin especificar"}</td>
                <td>
                  {profile.skills.length > 0 && <p><strong>Habilidades:</strong> {profile.skills.join(", ")}</p>}
                  {profile.tools.length > 0 && <p><strong>Herramientas:</strong> {profile.tools.join(", ")}</p>}
                  {profile.interests.length > 0 && <p><strong>Intereses:</strong> {profile.interests.join(", ")}</p>}
                </td>
                <td>
                  <span
                    className={
                      "inline-block rounded-sm border px-2.5 py-0.5 text-sm font-bold " +
                      (profile.disseminationGranted
                        ? "border-brand-line bg-brand-soft/45 text-brand-ink"
                        : "border-brand-line bg-brand-panel text-brand-ink")
                    }
                  >
                    {profile.disseminationGranted ? "Difusión autorizada" : "Sin autorización de difusión"}
                  </span>
                  <br />
                  <span className="text-sm">{profile.linksCount} enlace{profile.linksCount === 1 ? "" : "s"}</span>
                </td>
                <td>
                  <Link className={primaryButtonClass} href={`/admin/talent/${profile.personId}`}>
                    Ver perfil de talento
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </section>
    </main>
  );
}
