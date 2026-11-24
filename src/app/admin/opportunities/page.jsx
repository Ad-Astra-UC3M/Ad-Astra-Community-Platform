/**
 * @file Ruta `/admin/opportunities` del App Router. Muestra el listado editorial de todos los estados y
 * los formularios que crean oportunidades o cambian su estado.
 */

import { BackLink } from "../../../components/back-link";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../../components/form-styles";
import { PageHeading, pageClassName } from "../../../components/page-layout";
import { portalAlertClassName, portalFeedbackClassName, portalPanelClassName } from "../../../components/portal-ui";
import TextSpanWrapper2 from "../../../institutional/components/ui/TextSpanWrapper2";
import { listOpportunitiesForEditing } from "../../../server/opportunities/operations";
import { AdminTable } from "../admin-table";
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

const fieldClass = "grid min-w-0 gap-1.5 font-bold";
const textareaClass = `${inputClass} min-h-[5.5rem] resize-y`;

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
    <main className={pageClassName}>
      <BackLink href="/admin">Volver al panel</BackLink>
      <PageHeading
        eyebrow="Edición de contenido"
        title="Oportunidades"
        description="Crea borradores o publica oportunidades de prácticas e investigación. El archivo conserva los marcadores de estudiantes mostrando únicamente estado «Cerrada»."
      />

      {statusMessage && (
        <p className={portalFeedbackClassName + " empty:hidden"} role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className={portalAlertClassName} role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.25fr)]">
        <section className={portalPanelClassName} aria-label="Nueva oportunidad">
          <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
            Nueva oportunidad
          </TextSpanWrapper2>
          <form action={createAdminOpportunityAction} className="grid min-w-0 gap-4 sm:grid-cols-2">
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
            <label className={fieldClass + " sm:col-span-2"}>
              Descripción
              <textarea className={textareaClass} name="description" required rows={3} maxLength={2000} />
            </label>
            <label className={fieldClass + " sm:col-span-2"}>
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
            <label className={fieldClass + " sm:col-span-2"}>
              Texto alternativo de la portada
              <input className={inputClass} name="imageAlt" type="text" maxLength={200} />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className={primaryButtonClass}>Guardar oportunidad</button>
            </div>
          </form>
        </section>

        <section className="grid min-w-0 gap-4" aria-label="Listado completo de oportunidades">
          <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
            {`Todas las oportunidades (${opportunities.length})`}
          </TextSpanWrapper2>
          <AdminTable label="Todas las oportunidades" headers={["Oportunidad", "Tipo", "Estado", "Fecha límite", "Acciones"]}>
            {opportunities.map((opportunity) => (
              <tr key={opportunity.id}>
                <td>
                  <strong>{opportunity.title}</strong>
                  <br />
                  {[opportunity.organization, opportunity.location, opportunity.workModality].filter(Boolean).join(" · ")}
                  <p className="mt-1 text-sm">{opportunity.description}</p>
                  <p className="mt-1 text-sm">
                    Solicitud: {[opportunity.applicationUrl, opportunity.contactEmail].filter(Boolean).join(" · ") || "Sin medio de solicitud"}
                  </p>
                </td>
                <td>{typeLabels[opportunity.type]}</td>
                <td>
                  <span
                    className={
                      "inline-block rounded-sm border px-2.5 py-0.5 text-sm font-bold " +
                      (opportunity.status === "published"
                        ? "border-brand-line bg-brand-soft/45 text-brand-ink"
                        : opportunity.status === "draft"
                          ? "border-[#b79b30] bg-brand-accent text-brand-ink"
                          : "border-brand-line bg-brand-panel text-brand-ink")
                    }
                  >
                    {statusLabels[opportunity.status]}
                  </span>
                </td>
                <td>{opportunity.deadlineAt ? dateFormat.format(new Date(opportunity.deadlineAt)) : "—"}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
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
                </td>
              </tr>
            ))}
          </AdminTable>
        </section>
      </div>
    </main>
  );
}
