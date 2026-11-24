/**
 * @file Entrada del catálogo y de las reservas propias. `server-only` impide importar el módulo desde
 * un componente cliente. Las operaciones usan la identidad de la sesión.
 */

import "server-only";

import { requireUser } from "../auth/access";
import { cancelReservation, changeReservation, reserveShift } from "./participation";
import { getActivity, listActivities, listReservations } from "./portal-data";

/**
 * Carga las actividades publicadas para `ActivitiesPage` después de comprobar la sesión.
 * @returns El catálogo de `listActivities` con la reserva propia en cada turno.
 */
export async function listMyVisibleActivities() {
  const user = await requireUser("/activities");
  return listActivities(user.personId);
}

/**
 * Carga el detalle publicado que solicita `ActivityPage` después de comprobar la sesión.
 * @param id ID o slug de la ruta, también usado como destino de vuelta tras iniciar sesión.
 * @returns La actividad de `getActivity`, con turnos e imágenes, o `undefined`.
 */
export async function getMyVisibleActivity(id: string) {
  const user = await requireUser(`/activities/${encodeURIComponent(id)}`);
  return getActivity(id, user.personId);
}

/**
 * Carga las participaciones propias para `MyActivitiesPage`.
 * @returns Las reservas y sus opciones de cambio y cancelación calculadas por `listReservations`.
 */
export async function listMyReservations() {
  const user = await requireUser("/my-activities");
  return listReservations(user.personId);
}

/**
 * Resuelve la sesión de Inicio y obtiene la próxima reserva cuyo detalle puede abrir la persona.
 * @returns El usuario para el saludo y sus accesos, y la primera reserva futura de una actividad publicada.
 */
export async function loadMyHome() {
  const user = await requireUser("/home");
  const reservations = await listReservations(user.personId);
  const upcoming = reservations.find((reservation) =>
    reservation.agendaSection === "upcoming" && reservation.activityStatus === "published");
  return { user, upcoming };
}

/**
 * Atiende a `reserveActivityShift`. `reserveShift` adjudica la plaza a la persona de la sesión.
 * @param activityId Actividad a la que debe pertenecer el turno solicitado.
 * @param shiftId Valor de `FormData` que identifica el turno. Debe ser una cadena no vacía.
 * @returns `missing` si falta el campo o el código de reserva devuelto por `reserveShift`.
 */
export async function reserveMyShift(activityId: string, shiftId: unknown) {
  const user = await requireUser();
  if (typeof shiftId !== "string" || !shiftId) return "missing";
  return reserveShift(activityId, shiftId, user.personId);
}

/**
 * Atiende a `cancelActivityReservation` y limita la cancelación a la reserva de la sesión.
 * @param shiftId Valor de `FormData` que identifica el turno de la reserva.
 * @returns `missing` si falta un ID de turno textual o el código de `cancelReservation`.
 */
export async function cancelMyReservation(shiftId: unknown) {
  const user = await requireUser();
  if (typeof shiftId !== "string" || !shiftId) return "missing";
  return cancelReservation(user.personId, shiftId);
}

/**
 * Atiende a `changeActivityShift` y limita el cambio a la reserva de la persona conectada.
 * @param fromShiftId Campo del formulario que identifica el turno actual.
 * @param toShiftId Campo del formulario que identifica el turno seleccionado como destino.
 * @returns `missing` si algún campo no es texto o el código de `changeReservation`.
 */
export async function changeMyReservation(fromShiftId: unknown, toShiftId: unknown) {
  const user = await requireUser();
  if (typeof fromShiftId !== "string" || typeof toShiftId !== "string") return "missing";
  return changeReservation(user.personId, fromShiftId, toShiftId);
}
