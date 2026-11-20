import Link from "next/link";
import { BackLink } from "../../../components/back-link";
import { searchTalentForConsultation } from "../../../server/profiles/operations";

export const metadata = { title: "Consulta de talento" };

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";
const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";
const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

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
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="grid min-w-0 gap-4">
        <p className="text-[0.9rem] font-bold text-brand-primary">Consulta de talento</p>
        <h1>Perfiles voluntarios de talento</h1>
        <p className="max-w-[48ch] text-[1.2rem] leading-[1.55]">
          Acceso restringido exclusivamente a la capacidad de consulta de talento. Filtra por habilidades, herramientas,
          intereses, sectores o idiomas.
        </p>
      </header>

      <section className={panelClass} aria-label="Buscar perfiles de talento">
        <h2>Buscar perfiles</h2>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-0 flex-1 basis-56 gap-1.5 font-bold">
            Habilidades, herramientas, intereses o perfil
            <input
              className="min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink"
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
        <h2>Perfiles encontrados ({profiles.length})</h2>
        {profiles.length === 0 ? (
          <section className={panelClass}>
            <p>
              {query
                ? "No hay perfiles de talento que coincidan con esa búsqueda."
                : "Todavía no hay perfiles voluntarios de talento registrados."}
            </p>
          </section>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0">
            {profiles.map((profile) => (
              <li className={panelClass} key={profile.personId}>
                <p className="text-[0.9rem] font-bold text-brand-primary">
                  {profile.disseminationGranted ? "Difusión autorizada" : "Sin autorización de difusión"} ·{" "}
                  {profile.linksCount} enlace{profile.linksCount === 1 ? "" : "s"}
                </p>
                <h3>{profile.name}</h3>
                {profile.headline && <p><strong>{profile.headline}</strong></p>}
                <p>
                  {[profile.degree, profile.course, profile.university, profile.expectedGraduationYear]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {profile.skills.length > 0 && <p>Habilidades: {profile.skills.join(", ")}</p>}
                {profile.tools.length > 0 && <p>Herramientas: {profile.tools.join(", ")}</p>}
                {profile.interests.length > 0 && <p>Intereses: {profile.interests.join(", ")}</p>}
                <div>
                  <Link className={primaryButtonClass} href={`/admin/talent/${profile.personId}`}>
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
