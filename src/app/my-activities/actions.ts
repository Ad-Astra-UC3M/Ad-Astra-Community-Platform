/**
 * @file Server Actions de Mis actividades. Adaptan los datos de formulario para el módulo de reservas y
 * redirigen con el código obtenido.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelMyReservation, changeMyReservation } from "../../server/activities/portal";

/**
 * Atiende al formulario de cancelación de `MyActivitiesPage`. Delega la operación a
 * `cancelMyReservation` y actualiza la agenda de Inicio si se libera la plaza.
 * @param formData Datos del formulario. El campo `shiftId` indica qué reserva de la sesión se cancela.
 * @returns Redirige a Mis actividades con el código de cancelación en `status`.
 */
export async function cancelActivityReservation(formData: FormData) {
  const result = await cancelMyReservation(formData.get("shiftId"));
  if (result === "cancelled") revalidatePath("/home");
  redirect(`/my-activities?status=${result}`);
}

/**
 * Delega el cambio de turno de `MyActivitiesPage` a `changeMyReservation` y actualiza Inicio
 * si la reserva pasa al nuevo turno.
 * @param formData Datos del formulario con `fromShiftId` para la reserva actual y `toShiftId` para el
 * turno destino.
 * @returns Redirige a Mis actividades con el código del cambio en `status`.
 */
export async function changeActivityShift(formData: FormData) {
  const result = await changeMyReservation(formData.get("fromShiftId"), formData.get("toShiftId"));
  if (result === "changed") revalidatePath("/home");
  redirect(`/my-activities?status=${result}`);
}
