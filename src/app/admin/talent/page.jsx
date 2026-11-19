import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { searchTalentProfiles } from "../../../demo/admin";
import { requireCapability } from "../access";

export const metadata = { title: "Consulta de talento" };

export default async function AdminTalentPage({ searchParams }) {
  const viewer = await requireCapability("talent_consultation");
  const resolved = await searchParams;
  const query = typeof resolved?.q === "string" ? resolved.q : "";
  const profiles = searchTalentProfiles(viewer.workspaceId, query);

  return (
    <main className="shell stack">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="stack">
        <p className="eyebrow">Consulta de talento</p>
        <h1>Perfiles voluntarios de talento</h1>
        <p className="lead">
          Acceso restringido exclusivamente a la capacidad de consulta de talento. Filtra por habilidades, herramientas,
          intereses, sectores o idiomas.
        </p>
      </header>

      <section className="panel stack" aria-label="Buscar perfiles de talento">
        <h2>Buscar perfiles</h2>
        <form method="get" className="action-row">
          <label className="field">
            Habilidades, herramientas, intereses o perfil
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Ejemplo: Python, Simulink, propulsión, GNC"
            />
          </label>
          <button type="submit" className="button">Buscar</button>
          {query && <Link className="button secondary" href="/admin/talent">Limpiar</Link>}
        </form>
      </section>

      <section className="stack" aria-label="Resultados de talento">
        <h2>Perfiles encontrados ({profiles.length})</h2>
        {profiles.length === 0 ? (
          <section className="panel">
            <p>
              {query
                ? "No hay perfiles de talento que coincidan con esa búsqueda."
                : "Todavía no hay perfiles voluntarios de talento registrados."}
            </p>
          </section>
        ) : (
          <ul className="stack">
            {profiles.map((profile) => (
              <li className="panel stack" key={profile.accountId}>
                <p className="eyebrow">
                  {profile.disseminationGranted ? "Difusión autorizada" : "Sin autorización de difusión"} ·{" "}
                  {profile.linksCount} enlace{profile.linksCount === 1 ? "" : "s"}
                </p>
                <h3>{profile.name}</h3>
                {profile.headline && <p><strong>{profile.headline}</strong></p>}
                <p>
                  {[profile.degree, profile.course, profile.university, profile.graduationYear]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {profile.skills.length > 0 && <p>Habilidades: {profile.skills.join(", ")}</p>}
                {profile.tools.length > 0 && <p>Herramientas: {profile.tools.join(", ")}</p>}
                {profile.interests.length > 0 && <p>Intereses: {profile.interests.join(", ")}</p>}
                <div>
                  <Link className="button" href={`/admin/talent/${profile.accountId}`}>
                    Ver perfil de talento
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
