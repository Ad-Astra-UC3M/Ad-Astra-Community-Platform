import { BackLink } from "../../../components/back-link";
import { listAdminOpportunities } from "../../../demo/admin";
import { requireCapability } from "../access";
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
  ["missing_title", "Para publicar debes indicar un título."],
  ["missing_description", "Para publicar debes indicar una descripción."],
  ["missing_contact", "Para publicar debes indicar una URL HTTPS de solicitud o un correo de contacto."],
  ["invalid_application_url", "La URL de solicitud debe empezar por https://."],
  ["invalid_contact_email", "El correo de contacto no tiene un formato válido."],
  ["invalid_image_url", "La URL de la imagen debe empezar por https://."],
  ["missing_image_alt", "Si añades una imagen de portada, el texto alternativo es obligatorio."],
  ["invalid_info_url", "La URL de información adicional debe empezar por https://."],
  ["missing", "No se encontró la oportunidad solicitada."],
]);

export default async function AdminOpportunitiesPage({ searchParams }) {
  const editor = await requireCapability("content_editing");
  const resolvedSearch = await searchParams;
  const statusCode = typeof resolvedSearch?.status === "string" ? resolvedSearch.status : "";
  const errorCode = typeof resolvedSearch?.error === "string" ? resolvedSearch.error : "";

  const opportunities = listAdminOpportunities(editor.workspaceId);
  const statusMessage = statusMessages.get(statusCode);
  const errorMessage = errorMessages.get(errorCode);

  return (
    <main className="shell stack">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="stack">
        <p className="eyebrow">Edición de contenido</p>
        <h1>Oportunidades</h1>
        <p className="lead">
          Crea borradores o publica oportunidades de prácticas e investigación. El archivo conserva los marcadores de
          estudiantes mostrando únicamente estado «Cerrada».
        </p>
      </header>

      {statusMessage && <p className="notice" role="status">{statusMessage}</p>}
      {errorMessage && <p className="notice" role="alert">{errorMessage}</p>}

      <section className="panel stack" aria-label="Nueva oportunidad">
        <h2>Nueva oportunidad</h2>
        <form action={createAdminOpportunityAction} className="stack">
          <label className="field">
            Tipo
            <select name="type" defaultValue="internship">
              <option value="internship">Prácticas</option>
              <option value="research">Investigación</option>
            </select>
          </label>
          <label className="field">
            Estado inicial
            <select name="status" defaultValue="draft">
              <option value="draft">Borrador</option>
              <option value="published">Publicada</option>
            </select>
          </label>
          <label className="field">
            Título
            <input name="title" type="text" required maxLength={160} />
          </label>
          <label className="field">
            Organización o grupo
            <input name="organization" type="text" required maxLength={160} />
          </label>
          <label className="field">
            Descripción
            <textarea name="description" required rows={3} maxLength={2000} />
          </label>
          <label className="field">
            Requisitos
            <textarea name="requirements" rows={2} maxLength={1500} />
          </label>
          <label className="field">
            Ubicación
            <input name="location" type="text" maxLength={120} />
          </label>
          <label className="field">
            Modalidad
            <input name="modality" type="text" maxLength={80} placeholder="Presencial / Híbrida / Remota" />
          </label>
          <label className="field">
            Responsable o tutor/a (opcional)
            <input name="lead" type="text" maxLength={120} />
          </label>
          <label className="field">
            Fecha límite (opcional)
            <input name="deadline" type="date" />
          </label>
          <label className="field">
            URL de solicitud externa (HTTPS)
            <input name="applicationUrl" type="url" placeholder="https://ejemplo.org/solicitud" />
          </label>
          <label className="field">
            Correo de contacto (opcional si indicas URL de solicitud)
            <input name="contactEmail" type="email" placeholder="talento@ejemplo.org" />
          </label>
          <label className="field">
            URL de información adicional (HTTPS opcional)
            <input name="infoUrl" type="url" placeholder="https://ejemplo.org/info" />
          </label>
          <label className="field">
            Imagen de portada (HTTPS opcional)
            <input name="imageUrl" type="url" placeholder="https://ejemplo.org/portada.png" />
          </label>
          <label className="field">
            Texto alternativo de la portada
            <input name="imageAlt" type="text" maxLength={200} />
          </label>
          <div>
            <button type="submit" className="button">Guardar oportunidad</button>
          </div>
        </form>
      </section>

      <section className="stack" aria-label="Listado completo de oportunidades">
        <h2>Todas las oportunidades ({opportunities.length})</h2>
        {opportunities.map((opportunity) => (
          <article className="panel stack" key={opportunity.id}>
            <header className="stack">
              <p className="eyebrow">
                {typeLabels[opportunity.type]} · {statusLabels[opportunity.status]}
              </p>
              <h3>{opportunity.title}</h3>
              <p>
                {[opportunity.organization, opportunity.location, opportunity.modality].filter(Boolean).join(" · ")}
              </p>
            </header>
            <p>{opportunity.description}</p>
            {opportunity.deadline && (
              <p>Fecha límite: {dateFormat.format(new Date(opportunity.deadline))}</p>
            )}
            <p>
              Solicitud:{" "}
              {[opportunity.applicationUrl, opportunity.contactEmail].filter(Boolean).join(" · ") || "Sin medio de solicitud"}
            </p>
            <div className="action-row">
              {opportunity.status !== "published" && (
                <form action={setAdminOpportunityStatusAction}>
                  <input type="hidden" name="opportunityId" value={opportunity.id} />
                  <input type="hidden" name="status" value="published" />
                  <button type="submit" className="button secondary">Publicar</button>
                </form>
              )}
              {opportunity.status !== "draft" && (
                <form action={setAdminOpportunityStatusAction}>
                  <input type="hidden" name="opportunityId" value={opportunity.id} />
                  <input type="hidden" name="status" value="draft" />
                  <button type="submit" className="button secondary">Pasar a borrador</button>
                </form>
              )}
              {opportunity.status !== "archived" && (
                <form action={setAdminOpportunityStatusAction}>
                  <input type="hidden" name="opportunityId" value={opportunity.id} />
                  <input type="hidden" name="status" value="archived" />
                  <button type="submit" className="button secondary">Archivar</button>
                </form>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
