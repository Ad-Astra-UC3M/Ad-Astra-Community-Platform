/**
 * Operaciones de cuentas para las páginas y Server Actions de administración. Comprueban
 * capacidades en cada llamada y pasan al repositorio la identidad de sesión cuando se necesita
 * auditoría. Véase docs/backend/accounts.md.
 */

import "server-only";

import { listShifts } from "../activities/portal-data";
import { requireAdminAny } from "../auth/access";
import { getAccountAdminDetail, getAdminMetrics, searchAccounts, type AccountSearchFilters } from "./repository";
import type { AccountStatus } from "../../db/schema";
import { requireCapability, revokeUserSessions } from "../auth/access";
import { isCapabilityCode } from "../auth/service";
import { setProfileCapability, setProfileStatus } from "./repository";

/**
 * Autoriza y delega el cambio de permisos que solicita toggleAccountCapabilityAction.
 *
 * @param targetAccountId - Identificador de la cuenta que recibe o pierde el permiso.
 * @param capability - Código recibido del formulario. Se valida antes de escribir.
 * @param enabled - Indica si se concede o revoca la capacidad.
 * @returns Resultado del repositorio con el administrador de sesión como actor, o null si falta
 *   la cuenta objetivo en el formulario o el código es inválido.
 */
export async function changeAccountCapability(
  targetAccountId: string,
  capability: string,
  enabled: boolean,
) {
  const admin = await requireCapability("general_admin");
  if (!targetAccountId || !isCapabilityCode(capability)) return null;
  return setProfileCapability(targetAccountId, capability, enabled, admin.personId);
}

/**
 * Aplica el cambio de estado solicitado por setAccountStatusAction tras exigir general_admin.
 *
 * @param targetAccountId - Identificador del perfil que se va a activar o desactivar.
 * @param status - Estado que se solicita guardar en el perfil.
 * @returns Resultado del cambio auditado o null si falta el identificador. Conecta la
 *   revocación de sesiones al desactivar.
 */
export async function changeAccountStatus(targetAccountId: string, status: AccountStatus) {
  const admin = await requireCapability("general_admin");
  if (!targetAccountId) return null;
  return setProfileStatus(targetAccountId, status, admin.personId, revokeUserSessions);
}

/**
 * Exige acceso administrativo y carga solo los datos permitidos para AdminPage.
 *
 * @returns Capacidades de sesión, métricas si tiene general_admin y turnos de validación si
 *   tiene attendance_validation. Las consultas autorizadas se ejecutan en paralelo.
 */
export async function loadAdminDashboard() {
  const user = await requireAdminAny();
  const capabilities = user.capabilities;
  const [metrics, shifts] = await Promise.all([
    capabilities.includes("general_admin") ? getAdminMetrics() : null,
    capabilities.includes("attendance_validation") ? listShifts() : [],
  ]);
  return { capabilities, metrics, shifts };
}

/**
 * Protege con general_admin la búsqueda que AdminAccountsPage solicita durante el renderizado.
 *
 * @param filters - Texto, titulación, curso, estado y participación obtenidos de la consulta de
 *   la URL.
 * @returns Resúmenes de las cuentas que cumplen los filtros.
 */
export async function searchAdminAccounts(filters: AccountSearchFilters) {
  await requireCapability("general_admin");
  return searchAccounts(filters);
}

/**
 * Protege con general_admin la ficha que solicita AdminAccountDetailPage.
 *
 * @param id - Identificador del perfil en el segmento dinámico.
 * @returns Detalle de la cuenta o null si no existe o su identificador es inválido.
 */
export async function getAdminAccount(id: string) {
  await requireCapability("general_admin");
  return getAccountAdminDetail(id);
}
