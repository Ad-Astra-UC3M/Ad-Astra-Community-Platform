/**
 * @file Entrada del panel de edición de actividades. `server-only` limita su uso a servidor y cada
 * operación exige `content_editing` antes de delegar en `admin-data.ts`.
 */

import "server-only";

import type { PublishStatus } from "../../db/schema";
import { requireCapability } from "../auth/access";
import * as data from "./admin-data";

export type { AdminActivityImageInput } from "./admin-data";

/**
 * Comprueba el acceso a la edición y carga el listado para `AdminActivitiesPage`.
 * @returns Las actividades, con turnos, ocupación e imágenes, en cualquier estado de publicación.
 */
export async function listAdminActivities() {
  await requireCapability("content_editing");
  return data.listAdminActivities();
}

/**
 * Atiende a `createAdminActivityAction`. La capa de datos registra la creación con el perfil editor de
 * la sesión como actor.
 * @param input Campos de la actividad, turnos iniciales e imágenes que validará `admin-data.ts`.
 * @returns La actividad creada o un código de error.
 */
export async function createAdminActivity(input: data.CreateAdminActivityInput) {
  const editor = await requireCapability("content_editing");
  return data.createAdminActivity(input, editor.personId);
}

/**
 * Atiende a `addActivityShiftAction` y delega el alta del turno después de comprobar el acceso a
 * edición.
 * @param activityId UUID de la actividad a la que se añade el turno.
 * @param input Nombre, horario, aforo y ubicación opcional del turno.
 * @returns El turno creado o un código de error.
 */
export async function addActivityShift(activityId: string, input: data.AdminShiftInput) {
  await requireCapability("content_editing");
  return data.addActivityShift(activityId, input);
}

/**
 * Atiende a `addActivityImageAction` y delega la incorporación de una imagen a la galería.
 * @param activityId ID o slug con el que la capa de datos localiza la actividad.
 * @param input URL HTTPS, texto alternativo y posición de la imagen.
 * @returns `saved` o el código de error de la capa de datos.
 */
export async function addActivityImage(activityId: string, input: data.AddActivityImageInput) {
  await requireCapability("content_editing");
  return data.addActivityImage(activityId, input);
}

/**
 * Atiende a `updateShiftCapacityAction` y delega el cambio de aforo con su comprobación de ocupación.
 * @param shiftId UUID del turno que se modifica.
 * @param capacity Nuevo límite de plazas. `null` indica aforo ilimitado.
 * @returns El aforo aplicado con la ocupación actual o un código de error.
 */
export async function updateShiftCapacity(shiftId: string, capacity: number | null) {
  await requireCapability("content_editing");
  return data.updateShiftCapacity(shiftId, capacity);
}

/**
 * Atiende a `deleteShiftAction` y delega la eliminación de un turno sin reservas ni historial.
 * @param shiftId UUID del turno que se solicita eliminar.
 * @returns El ID eliminado o un código de error.
 */
export async function deleteShift(shiftId: string) {
  await requireCapability("content_editing");
  return data.deleteShift(shiftId);
}

/**
 * Atiende a `setActivityStatusAction`. La capa de datos registra el cambio con el perfil editor de la
 * sesión como actor.
 * @param activityId UUID de la actividad que cambia de estado.
 * @param status Estado de publicación solicitado.
 * @returns El estado aplicado o un código de error.
 */
export async function setActivityStatus(activityId: string, status: PublishStatus) {
  const editor = await requireCapability("content_editing");
  return data.setActivityStatus(activityId, status, editor.personId);
}
