/**
 * Server Actions de alta y estado de oportunidades. Next.js entrega el FormData de los
 * formularios editoriales, que se adapta a operaciones con content_editing antes de redirigir
 * al listado.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OpportunityType, PublishStatus } from "../../../db/schema";
import { changeOpportunityStatus, createOpportunityForEditing } from "../../../server/opportunities/operations";

/**
 * Lee y normaliza los valores de texto de ambas acciones editoriales.
 *
 * @param form - Campos del formulario enviado.
 * @param name - Nombre del control que se lee.
 * @returns Texto recortado o cadena vacía para valores ausentes o no textuales.
 */
function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Convierte la fecha de plazo en el alta editorial a un instante que admite el repositorio.
 *
 * @param raw - Fecha del formulario sin hora.
 * @returns Milisegundos de las 23:59:59 UTC de ese día o null si no hay fecha interpretable.
 */
function parseOptionalDate(raw: string): number | null {
  if (!raw) return null;
  const parsed = Date.parse(`${raw}T23:59:59Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Invalida el listado editorial, el catálogo y los marcadores con revalidatePath.
 *
 * @returns Sin valor. Ambas acciones editoriales la ejecutan antes de redirigir para actualizar
 *   esas vistas.
 */
function revalidateOpportunityPaths() {
  revalidatePath("/admin/opportunities");
  revalidatePath("/opportunities");
  revalidatePath("/bookmarks");
}

/**
 * Server Action del formulario de alta de AdminOpportunitiesPage. Adapta los campos a
 * createOpportunityForEditing y revalida las rutas del catálogo.
 *
 * @param form - Tipo, estado inicial y datos de descripción, publicación, contacto e imagen del
 *   alta.
 * @returns Redirige a /admin/opportunities con created o el código de error.
 */
export async function createAdminOpportunityAction(form: FormData) {
  const rawType = readField(form, "type");
  const type: OpportunityType = rawType === "research" ? "research" : "internship";
  const rawStatus = readField(form, "status");
  const status: PublishStatus = rawStatus === "published" ? "published" : "draft";

  const result = await createOpportunityForEditing({
    type,
    title: readField(form, "title"),
    organization: readField(form, "organization"),
    description: readField(form, "description"),
    requirements: readField(form, "requirements") || null,
    location: readField(form, "location") || null,
    workModality: readField(form, "modality") || null,
    researchLead: readField(form, "lead") || null,
    deadlineAt: parseOptionalDate(readField(form, "deadline")),
    applicationUrl: readField(form, "applicationUrl") || null,
    contactEmail: readField(form, "contactEmail") || null,
    imageUrl: readField(form, "imageUrl") || null,
    imageAlt: readField(form, "imageAlt") || null,
    infoUrl: readField(form, "infoUrl") || null,
    status,
  });

  revalidateOpportunityPaths();
  if (!result.ok) {
    redirect(`/admin/opportunities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/opportunities?status=created");
}

/**
 * Server Action de los botones de estado de AdminOpportunitiesPage. Aplica el cambio mediante
 * changeOpportunityStatus y revalida las vistas del catálogo.
 *
 * @param form - Incluye opportunityId y status. Mantiene draft o archived explícitos y en los
 *   demás casos solicita published.
 * @returns Redirige a /admin/opportunities con updated y el nuevo estado, o con el error.
 */
export async function setAdminOpportunityStatusAction(form: FormData) {
  const opportunityId = readField(form, "opportunityId");
  const rawStatus = readField(form, "status");
  const status: PublishStatus =
    rawStatus === "draft" || rawStatus === "archived" ? rawStatus : "published";

  const result = await changeOpportunityStatus(opportunityId, status);
  revalidateOpportunityPaths();
  if (!result.ok) {
    redirect(`/admin/opportunities?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/admin/opportunities?status=updated_${status}`);
}
