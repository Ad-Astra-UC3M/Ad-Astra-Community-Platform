/**
 * Frontera de sesión del catálogo y los marcadores, y frontera de capacidad de la edición. Las
 * páginas del App Router llaman a las lecturas y las Server Actions llaman a los cambios. Véase
 * docs/backend/opportunities.md.
 */

import "server-only";

import { getOpportunity, listAdminOpportunities, listBookmarks, listOpportunities, type OpportunityType } from "./repository";
import type { PublishStatus } from "../../db/schema";
import { requireCapability, requireUser } from "../auth/access";
import {
  createAdminOpportunity,
  removeBookmark,
  saveBookmark,
  setAdminOpportunityStatus,
  type CreateAdminOpportunityInput,
} from "./repository";

/**
 * Autoriza el alta que solicita createAdminOpportunityAction con content_editing.
 *
 * @param input - Datos de la oportunidad y estado inicial que valida el repositorio.
 * @returns Resultado del alta auditada con el perfil del editor de sesión.
 */
export async function createOpportunityForEditing(input: CreateAdminOpportunityInput) {
  const editor = await requireCapability("content_editing");
  return createAdminOpportunity(input, editor.personId);
}

/**
 * Autoriza el cambio de estado que solicita setAdminOpportunityStatusAction con
 * content_editing.
 *
 * @param opportunityId - ID o slug de la oportunidad que se modifica.
 * @param status - Estado editorial que se solicita aplicar.
 * @returns Resultado del cambio auditado con el perfil del editor de sesión.
 */
export async function changeOpportunityStatus(opportunityId: string, status: PublishStatus) {
  const editor = await requireCapability("content_editing");
  return setAdminOpportunityStatus(opportunityId, status, editor.personId);
}

/**
 * Resuelve al titular desde la sesión para guardar el marcador solicitado por
 * saveOpportunityBookmark.
 *
 * @param opportunityId - ID o slug de la oportunidad publicada que se quiere marcar.
 * @returns saved si existe el marcador tras la operación o missing si no puede guardarse.
 */
export async function saveMyBookmark(opportunityId: string) {
  const user = await requireUser();
  return saveBookmark(user.personId, opportunityId);
}

/**
 * Resuelve al titular desde la sesión para retirar el marcador solicitado por
 * removeOpportunityBookmark.
 *
 * @param opportunityId - ID o slug del elemento que se quiere retirar.
 * @returns missing si el identificador está vacío o removed tras delegar la retirada
 *   idempotente.
 */
export async function removeMyBookmark(opportunityId: string) {
  const user = await requireUser();
  return opportunityId ? removeBookmark(user.personId, opportunityId) : "missing";
}

/**
 * Lee el catálogo de OpportunitiesPage para el usuario autenticado.
 *
 * @param type - Filtro opcional de prácticas o investigación que también se conserva en el
 *   destino de retorno al iniciar sesión.
 * @returns Oportunidades publicadas con el estado del marcador de ese usuario.
 */
export async function listVisibleOpportunities(type?: OpportunityType) {
  const nextPath = type ? "/opportunities?type=" + type : "/opportunities";
  const user = await requireUser(nextPath);
  return listOpportunities(user.personId, type);
}

/**
 * Lee el detalle de OpportunityDetailPage para el usuario autenticado y conserva su URL como
 * destino tras iniciar sesión.
 *
 * @param id - Identificador o slug de la oportunidad en la URL.
 * @returns Oportunidad publicada con el marcador de la sesión o null si el detalle no está
 *   disponible.
 */
export async function getVisibleOpportunity(id: string) {
  const user = await requireUser("/opportunities/" + encodeURIComponent(id));
  const opportunity = await getOpportunity(id, user.personId);
  return opportunity?.status === "published" ? opportunity : null;
}

/**
 * Identifica al titular desde la sesión antes de leer sus marcadores para BookmarksPage.
 *
 * @returns Marcadores propios de oportunidades publicadas y archivadas.
 */
export async function listMyBookmarks() {
  const user = await requireUser("/bookmarks");
  return listBookmarks(user.personId);
}

/**
 * Exige content_editing antes de consultar el listado de AdminOpportunitiesPage.
 *
 * @returns Oportunidades de todos los estados en orden editorial.
 */
export async function listOpportunitiesForEditing() {
  await requireCapability("content_editing");
  return listAdminOpportunities();
}
