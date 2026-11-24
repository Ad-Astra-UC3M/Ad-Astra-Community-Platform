/**
 * Server Actions compartidas por el catálogo, el detalle y los marcadores. La directiva «use
 * server» hace que Next.js procese los formularios en el servidor y entregue sus campos como
 * FormData.
 */

"use server";

import { redirect } from "next/navigation";
import { removeMyBookmark, saveMyBookmark } from "../../server/opportunities/operations";

/**
 * Restringe los destinos de vuelta de ambas acciones de marcadores.
 *
 * @param value - Campo returnTo del formulario, que puede ser texto, un archivo o null.
 * @returns Ruta permitida del catálogo, detalle o marcadores, o /opportunities como valor
 *   predeterminado.
 */
function safeReturnPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/opportunities";
  if (value === "/opportunities" || value === "/bookmarks") return value;
  if (value === "/opportunities?type=internship" || value === "/opportunities?type=research") return value;
  if (/^\/opportunities\/[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)) return value;
  return "/opportunities";
}

/**
 * Termina ambas acciones de marcadores con una redirección de Next.js que conserva la consulta
 * existente.
 *
 * @param path - Ruta interna ya validada por safeReturnPath.
 * @param status - Resultado que se codifica y añade como parámetro de consulta.
 * @returns No devuelve un valor porque redirect termina la acción.
 */
function redirectWithStatus(path: string, status: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}status=${encodeURIComponent(status)}`);
}

/**
 * Server Action de los formularios del catálogo y la ficha que guardan un marcador para la
 * sesión.
 *
 * @param formData - Aporta opportunityId para identificar la oportunidad y returnTo para
 *   escoger el destino permitido.
 * @returns Termina con una redirección a la vista de origen y el código devuelto por
 *   saveMyBookmark.
 */
export async function saveOpportunityBookmark(formData: FormData) {
  const opportunityId = formData.get("opportunityId");
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const result = await saveMyBookmark(typeof opportunityId === "string" ? opportunityId : "");

  redirectWithStatus(returnTo, result);
}

/**
 * Server Action de los formularios del catálogo, ficha y marcadores que retiran un marcador de
 * la sesión.
 *
 * @param formData - Aporta opportunityId para localizar el marcador y returnTo para escoger el
 *   destino permitido.
 * @returns Termina con una redirección a la vista de origen y el código devuelto por
 *   removeMyBookmark.
 */
export async function removeOpportunityBookmark(formData: FormData) {
  const opportunityId = formData.get("opportunityId");
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const result = await removeMyBookmark(typeof opportunityId === "string" ? opportunityId : "");

  redirectWithStatus(returnTo, result);
}
