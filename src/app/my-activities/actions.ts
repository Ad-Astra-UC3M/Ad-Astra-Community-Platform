/**
 * @file Server Actions de Mis actividades. Adaptan los datos de formulario para el módulo de reservas y
 * redirigen con el código obtenido.
 */

"use server";

import { redirect } from "next/navigation";
import { cancelMyReservation, changeMyReservation } from "../../server/activities/portal";

/**
 * Atiende al formulario de cancelación de `MyActivitiesPage`. Delega la operación a
 * `cancelMyReservation`.
 * @param formData Datos del formulario. El campo `shiftId` indica qué reserva de la sesión se cancela.
 * @returns Redirige a Mis actividades con el código de cancelación en `status`.
 */
export async function cancelActivityReservation(formData: FormData) {
  const result = await cancelMyReservation(formData.get("shiftId"));
  redirect(`/my-activities?status=${result}`);
}

/**
 * Atiende al formulario de cambio de `MyActivitiesPage`. Delega la operación a `changeMyReservation`.
 * @param formData Datos del formulario con `fromShiftId` para la reserva actual y `toShiftId` para el
 * turno destino.
 * @returns Redirige a Mis actividades con el código del cambio en `status`.
 */
export async function changeActivityShift(formData: FormData) {
  const result = await changeMyReservation(formData.get("fromShiftId"), formData.get("toShiftId"));
  redirect(`/my-activities?status=${result}`);
}
