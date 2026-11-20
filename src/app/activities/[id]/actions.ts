/**
 * @file Server Action que adapta el formulario de reserva del detalle de una actividad al módulo
 * protegido del portal.
 */

"use server";

import { redirect } from "next/navigation";
import { reserveMyShift } from "../../../server/activities/portal";

/**
 * Procesa el envío del formulario de `ShiftCard` mediante `reserveMyShift`.
 * @param activityId ID que `ActivityPage` vincula a la acción con `bind`.
 * @param formData Datos del formulario. `shiftId` identifica el turno que el servidor vuelve a validar.
 * @returns Redirige al detalle con `status` igual al código de la reserva.
 */
export async function reserveActivityShift(activityId: string, formData: FormData) {
  const result = await reserveMyShift(activityId, formData.get("shiftId"));
  redirect(`/activities/${encodeURIComponent(activityId)}?status=${result}`);
}
