/**
 * Frontera de acceso para el perfil propio, la consulta interna de talento y la tramitación de
 * supresiones. Las páginas consultan estas operaciones al renderizar y las Server Actions las
 * llaman al procesar formularios. Véase docs/backend/profiles.md.
 */

import "server-only";

import { getDeletionRequest, getMyDeletionRequest, listDeletionRequests } from "./deletion-requests";
import { getBasicProfile, getDisseminationStatus, getTalentProfile } from "./repository";
import { getTalentAdminDetail, searchTalentProfiles, type TalentSearchFilters } from "./talent-consultation";
import { requireCapability, requireUser } from "../auth/access";
import { requestAccountDeletion, resolveDeletionRequest } from "./deletion-requests";
import {
  saveTalentProfile,
  setDisseminationDecision,
  updateBasicProfile,
  type BasicProfileUpdateInput,
  type TalentProfileInput,
} from "./repository";

/**
 * Exige sesión para guardar el perfil básico desde saveBasicProfileAction.
 *
 * @param input - Campos editables y posibles campos de identidad que el repositorio contrasta
 *   con el perfil de sesión.
 * @returns Perfil guardado o error del repositorio.
 */
export async function updateMyProfile(input: BasicProfileUpdateInput) {
  const user = await requireUser();
  return updateBasicProfile(user.personId, input);
}

/**
 * Exige sesión para guardar el perfil de talento desde saveTalentProfileAction.
 *
 * @param input - Datos de formación, trayectoria, etiquetas, idiomas y enlaces que el
 *   repositorio valida y guarda.
 * @returns Perfil de talento guardado o error de validación o de titular ausente.
 */
export async function saveMyTalentProfile(input: TalentProfileInput) {
  const user = await requireUser();
  return saveTalentProfile(user.personId, input);
}

/**
 * Registra la decisión para el perfil de sesión cuando updateDisseminationAction procesa el
 * formulario.
 *
 * @param decision - Valor de granted. Los textos true y false se convierten al booleano que se
 *   persiste.
 * @returns La decisión registrada, invalid_decision para otras entradas o missing si el perfil
 *   no existe.
 */
export async function updateMyDissemination(decision: unknown) {
  const user = await requireUser();
  if (decision !== "true" && decision !== "false") {
    return { ok: false, error: "invalid_decision" } as const;
  }

  const granted = decision === "true";
  const status = await setDisseminationDecision(user.personId, granted);
  if (!status) return { ok: false, error: "missing" } as const;
  return { ok: true, granted } as const;
}

/**
 * Exige sesión y tramita la solicitud inicial de requestDeletionAction para el perfil
 * autenticado.
 *
 * @param reason - Texto opcional del formulario que el repositorio valida y adjunta a la nueva
 *   solicitud.
 * @returns Solicitud creada o ya abierta, o un error de validación o de perfil ausente.
 */
export async function requestMyAccountDeletion(reason: string) {
  const user = await requireUser();
  return requestAccountDeletion(user.personId, reason);
}

/**
 * Exige general_admin para aplicar el cambio de resolveDeletionRequestAction con el perfil de
 * sesión como autor.
 *
 * @param requestId - Identificador de la solicitud que se tramita.
 * @param status - Estado de revisión o resolución que se quiere aplicar.
 * @param resolutionNote - Nota que el repositorio valida al resolver.
 * @returns Resultado de la tramitación, o null si falta el identificador en el formulario.
 */
export async function reviewDeletionRequest(
  requestId: string,
  status: "in_review" | "resolved",
  resolutionNote: string,
) {
  const admin = await requireCapability("general_admin");
  if (!requestId) return null;
  return resolveDeletionRequest(requestId, status, resolutionNote, admin.personId);
}

/**
 * Exige sesión y toma su identificador para localizar la cuenta que muestra ProfilePage.
 *
 * @returns Perfil básico del titular o null si falta.
 */
export async function getMyProfile() {
  const user = await requireUser("/profile");
  return getBasicProfile(user.personId);
}

/**
 * Exige sesión y usa el mismo identificador para solicitante y titular en la lectura de
 * TalentProfilePage.
 *
 * @returns Perfil propio de talento, inicialmente vacío si aún no se ha guardado, o null si no
 *   existe el perfil básico.
 */
export async function getMyTalentProfile() {
  const user = await requireUser("/profile/talent");
  return getTalentProfile(user.personId, user.personId);
}

/**
 * Exige sesión una vez y consulta en paralelo la difusión y la supresión del titular para
 * ProfilePrivacyPage.
 *
 * @returns Estado e historial de difusión junto a la solicitud de supresión seleccionada, si
 *   existe.
 */
export async function getMyPrivacySettings() {
  const user = await requireUser("/profile/privacy");
  const [dissemination, deletionRequest] = await Promise.all([
    getDisseminationStatus(user.personId),
    getMyDeletionRequest(user.personId),
  ]);
  return { dissemination, deletionRequest };
}

/**
 * Exige talent_consultation para la búsqueda que realiza AdminTalentPage.
 *
 * @param filters - Texto o etiquetas que usa el repositorio al seleccionar perfiles.
 * @returns Resúmenes de talento para consulta interna con el indicador de difusión.
 */
export async function searchTalentForConsultation(filters: TalentSearchFilters) {
  await requireCapability("talent_consultation");
  return searchTalentProfiles(filters);
}

/**
 * Exige talent_consultation en la lectura de AdminTalentDetailPage.
 *
 * @param id - Identificador del perfil de talento en la URL.
 * @returns Ficha interna de talento o null si no se encuentra.
 */
export async function getTalentForConsultation(id: string) {
  await requireCapability("talent_consultation");
  return getTalentAdminDetail(id);
}

/**
 * Exige general_admin antes de consultar la cola de AdminDeletionRequestsPage.
 *
 * @returns Solicitudes ordenadas por estado y fecha.
 */
export async function listDeletionRequestsForReview() {
  await requireCapability("general_admin");
  return listDeletionRequests();
}

/**
 * Exige general_admin para la lectura de AdminDeletionRequestDetailPage.
 *
 * @param id - Identificador de la solicitud en la URL.
 * @returns Detalle administrativo o null si la solicitud no existe.
 */
export async function getDeletionRequestForReview(id: string) {
  await requireCapability("general_admin");
  return getDeletionRequest(id);
}
