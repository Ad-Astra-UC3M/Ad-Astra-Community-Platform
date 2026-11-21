/**
 * Ruta /admin/opportunities del App Router. Muestra el listado editorial de todos los estados y
 * los formularios que crean oportunidades o cambian su estado.
 */

import { BackLink } from "../../../components/back-link";
import { listOpportunitiesForEditing } from "../../../server/opportunities/operations";
import { createAdminOpportunityAction, setAdminOpportunityStatusAction } from "./actions";

export const metadata = { title: "Gestión de oportunidades" };

const typeLabels = {
  internship: "Prácticas",
  research: "Investigación",
};

const statusLabels = {
  draft: "Borrador",
  published: "Publicada",
  archived: "Archivada",
};

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

const statusMessages = new Map([
  ["created", "Oportunidad guardada correctamente."],
  ["updated_published", "Oportunidad publicada."],
  ["updated_draft", "Oportunidad movida a borrador."],
  ["updated_archived", "Oportunidad archivada. Los marcadores existentes mostrarán solo el estado «Cerrada»."],
]);

const errorMessages = new Map([
  ["missing_actor", "No se pudo identificar a la persona editora."],
  ["invalid_type", "El tipo de oportunidad indicado no es válido."],
  ["invalid_status", "El estado de oportunidad indicado no es válido."],
  ["invalid_slug", "El identificador de la oportunidad no es válido."],
  ["duplicate_slug", "Ya existe una oportunidad con ese identificador."],
  ["missing_title", "Para publicar debes indicar un título."],
  ["missing_organization", "Debes indicar la organización o grupo responsable."],
  ["missing_description", "Para publicar debes indicar una descripción."],
  ["missing_contact", "Para publicar debes indicar una URL HTTPS de solicitud o un correo de contacto."],
  ["invalid_application_url", "La URL de solicitud debe empezar por https://."],
  ["invalid_contact_email", "El correo de contacto no tiene un formato válido."],
  ["invalid_image_url", "La URL de la imagen debe empezar por https://."],
  ["missing_image_alt", "Si añades una imagen de portada, el texto alternativo es obligatorio."],
  ["invalid_info_url", "La URL de información adicional debe empezar por https://."],
  ["invalid_date", "La fecha límite indicada no es válida."],
  ["missing", "No se encontró la oportunidad solicitada."],
]);

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";
const fieldClass = "grid min-w-0 gap-1.5 font-bold";
const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";
const textareaClass = `${inputClass} resize-y`;
const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";
const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

/**
 * Next.js ejecuta este Server Component y llama a listOpportunitiesForEditing, que exige
 * content_editing.
 *
 * @param props - Propiedades de ruta suministradas por Next.js.
 * @param props.searchParams - Promesa con status y error para mostrar el resultado de las
 *   acciones editoriales.
 * @returns Pantalla editorial en JSX con un formulario de alta y botones de borrador,
 *   publicación o archivo según la oportunidad.
 */
export default async function AdminOpportunitiesPage({ searchParams }) {
  const resolvedSearch = await searchParams;
  const statusCode = typeof resolvedSearch?.status === "string" ? resolvedSearch.status : "";
  const errorCode = typeof resolvedSearch?.error === "string" ? resolvedSearch.error : "";

  const opportunities = await listOpportunitiesForEditing();
  const statusMessage = statusMessages.get(statusCode);
  const errorMessage = errorMessages.get(errorCode);

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="grid min-w-0 gap-4">
        <p className="text-[0.9rem] font-bold text-brand-primary">Edición de contenido</p>
        <h1>Oportunidades</h1>
        <p className="max-w-[48ch] text-[1.2rem] leading-[1.55]">
          Crea borradores o publica oportunidades de prácticas e investigación. El archivo conserva los marcadores de
          estudiantes mostrando únicamente estado «Cerrada».
        </p>
      </header>

      {statusMessage && (
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink empty:hidden" role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
          {errorMessage}
        </p>
      )}

      <section className={panelClass} aria-label="Nueva oportunidad">
        <h2>Nueva oportunidad</h2>
        <form action={createAdminOpportunityAction} className="grid min-w-0 gap-4">
          <label className={fieldClass}>
            Tipo
            <select className={inputClass} name="type" defaultValue="internship">
              <option value="internship">Prácticas</option>
              <option value="research">Investigación</option>
            </select>
          </label>
          <label className={fieldClass}>
            Estado inicial
            <select className={inputClass} name="status" defaultValue="draft">
              <option value="draft">Borrador</option>
              <option value="published">Publicada</option>
            </select>
          </label>
          <label className={fieldClass}>
            Título
            <input className={inputClass} name="title" type="text" required maxLength={160} />
          </label>
          <label className={fieldClass}>
            Organización o grupo
            <input className={inputClass} name="organization" type="text" required maxLength={160} />
          </label>
          <label className={fieldClass}>
            Descripción
            <textarea className={textareaClass} name="description" required rows={3} maxLength={2000} />
          </label>
          <label className={fieldClass}>
            Requisitos
            <textarea className={textareaClass} name="requirements" rows={2} maxLength={1500} />
          </label>
          <label className={fieldClass}>
            Ubicación
            <input className={inputClass} name="location" type="text" maxLength={120} />
          </label>
          <label className={fieldClass}>
            Modalidad
            <input className={inputClass} name="modality" type="text" maxLength={80} placeholder="Presencial / Híbrida / Remota" />
          </label>
          <label className={fieldClass}>
            Responsable o tutor/a (opcional)
            <input className={inputClass} name="lead" type="text" maxLength={120} />
          </label>
          <label className={fieldClass}>
            Fecha límite (opcional)
            <input className={inputClass} name="deadline" type="date" />
          </label>
          <label className={fieldClass}>
            URL de solicitud externa (HTTPS)
            <input className={inputClass} name="applicationUrl" type="url" placeholder="https://ejemplo.org/solicitud" />
          </label>
          <label className={fieldClass}>
            Correo de contacto (opcional si indicas URL de solicitud)
            <input className={inputClass} name="contactEmail" type="email" placeholder="talento@ejemplo.org" />
          </label>
          <label className={fieldClass}>
            URL de información adicional (HTTPS opcional)
            <input className={inputClass} name="infoUrl" type="url" placeholder="https://ejemplo.org/info" />
          </label>
          <label className={fieldClass}>
            Imagen de portada (HTTPS opcional)
            <input className={inputClass} name="imageUrl" type="url" placeholder="https://ejemplo.org/portada.png" />
          </label>
          <label className={fieldClass}>
            Texto alternativo de la portada
            <input className={inputClass} name="imageAlt" type="text" maxLength={200} />
          </label>
          <div>
            <button type="submit" className={primaryButtonClass}>Guardar oportunidad</button>
          </div>
        </form>
      </section>

      <section className="grid min-w-0 gap-4" aria-label="Listado completo de oportunidades">
        <h2>Todas las oportunidades ({opportunities.length})</h2>
        {opportunities.map((opportunity) => (
          <article className={panelClass} key={opportunity.id}>
            <header className="grid min-w-0 gap-4">
              <p className="text-[0.9rem] font-bold text-brand-primary">
                {typeLabels[opportunity.type]} · {statusLabels[opportunity.status]}
              </p>
              <h3>{opportunity.title}</h3>
              <p>
                {[opportunity.organization, opportunity.location, opportunity.workModality].filter(Boolean).join(" · ")}
              </p>
            </header>
            <p>{opportunity.description}</p>
            {opportunity.deadlineAt && (
              <p>Fecha límite: {dateFormat.format(new Date(opportunity.deadlineAt))}</p>
            )}
            <p>
              Solicitud:{" "}
              {[opportunity.applicationUrl, opportunity.contactEmail].filter(Boolean).join(" · ") || "Sin medio de solicitud"}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {opportunity.status !== "published" && (
                <form action={setAdminOpportunityStatusAction}>
                  <input type="hidden" name="opportunityId" value={opportunity.id} />
                  <input type="hidden" name="status" value="published" />
                  <button type="submit" className={secondaryButtonClass}>Publicar</button>
                </form>
              )}
              {opportunity.status !== "draft" && (
                <form action={setAdminOpportunityStatusAction}>
                  <input type="hidden" name="opportunityId" value={opportunity.id} />
                  <input type="hidden" name="status" value="draft" />
                  <button type="submit" className={secondaryButtonClass}>Pasar a borrador</button>
                </form>
              )}
              {opportunity.status !== "archived" && (
                <form action={setAdminOpportunityStatusAction}>
                  <input type="hidden" name="opportunityId" value={opportunity.id} />
                  <input type="hidden" name="status" value="archived" />
                  <button type="submit" className={secondaryButtonClass}>Archivar</button>
                </form>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
