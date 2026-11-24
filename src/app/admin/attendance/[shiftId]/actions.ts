/**
 * @file Server Actions del control de asistencia. La validación de tarjeta devuelve un mensaje al
 * escáner. Las operaciones manuales redirigen al detalle del turno.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  correctAttendance,
  manualConfirmAttendance,
  registerAtDoor,
  validateAttendanceCard,
  type CardValidationResult,
} from "../../../../server/activities/attendance";

const messages: Record<CardValidationResult, string> = {
  recorded: "Asistencia registrada.",
  already: "Ya registrado.",
  deactivated: "La cuenta está desactivada y no puede validar asistencia.",
  missing: "Esta persona no tiene reserva en el turno seleccionado.",
  invalid_card: "Tarjeta no válida o revocada.",
};

/**
 * Extrae texto para las acciones de puerta y rectificación.
 * @param form Datos del formulario recibido.
 * @param name Nombre del campo que se lee.
 * @returns El texto sin espacios en los extremos o una cadena vacía si falta o es un archivo.
 */
function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Las acciones del turno invalidan con `revalidatePath` el detalle, el panel principal y
 * las agendas de Inicio y Mis actividades.
 * @param shiftId ID que identifica el detalle de asistencia que debe revalidarse.
 * @returns Sin valor. Solicita a Next.js actualizar las rutas afectadas.
 */
function revalidateAttendancePaths(shiftId: string) {
  revalidatePath(`/admin/attendance/${encodeURIComponent(shiftId)}`);
  revalidatePath("/admin");
  revalidatePath("/my-activities");
  revalidatePath("/home");
}

/**
 * Atiende al `Scanner` a través de `useActionState`. Llama a `validateAttendanceCard` y revalida las
 * vistas cuando la tarjeta supera la verificación.
 * @param shiftId ID de turno vinculado a la acción desde `AttendancePage`.
 * @param _previous Estado anterior que proporciona `useActionState`. Se recibe para respetar su firma.
 * @param form Datos del formulario con el campo `token`, escaneado o pegado.
 * @returns El mensaje que el escáner muestra como nuevo estado de la acción.
 */
export async function validateCard(shiftId: string, _previous: string, form: FormData) {
  const result = await validateAttendanceCard(shiftId, form.get("token"));
  if (result !== "invalid_card") revalidateAttendancePaths(shiftId);
  return messages[result];
}

/**
 * Atiende el formulario de alta en puerta de `AttendancePage`. Llama a `registerAtDoor` y revalida las
 * vistas.
 * @param form ID de turno, campo `targetAccountId` del perfil elegido y motivo obligatorio.
 * @returns Redirige al turno con `door=registered` o el código de error.
 */
export async function registerAtDoorAction(form: FormData) {
  const shiftId = readField(form, "shiftId");
  const targetAccountId = readField(form, "targetAccountId");
  const reason = readField(form, "reason");

  const result = await registerAtDoor(shiftId, targetAccountId, reason);
  revalidateAttendancePaths(shiftId);

  const status = result.ok ? "registered" : result.error;
  redirect(`/admin/attendance/${encodeURIComponent(shiftId)}?door=${encodeURIComponent(status)}`);
}

/**
 * Atiende el formulario de confirmación manual de `AttendancePage`. Llama a `manualConfirmAttendance` y
 * revalida las vistas.
 * @param form ID de turno, ID de persona y motivo obligatorio de la confirmación.
 * @returns Redirige al turno con `manual=confirmed` o el código de error.
 */
export async function confirmManualAttendanceAction(form: FormData) {
  const shiftId = readField(form, "shiftId");
  const personId = readField(form, "personId");
  const reason = readField(form, "reason");

  const result = await manualConfirmAttendance(shiftId, personId, reason);
  revalidateAttendancePaths(shiftId);

  const status = result.ok ? "confirmed" : result.error;
  redirect(`/admin/attendance/${encodeURIComponent(shiftId)}?manual=${encodeURIComponent(status)}`);
}

/**
 * Atiende el formulario de rectificación de `AttendancePage`. Llama a `correctAttendance` y revalida
 * las vistas.
 * @param form ID de turno, ID de persona, estado destino y motivo. El estado se interpreta como
 * `attended` o `booked`.
 * @returns Redirige con `manual=reverted`, `manual=confirmed` o el código de error.
 */
export async function correctAttendanceAction(form: FormData) {
  const shiftId = readField(form, "shiftId");
  const personId = readField(form, "personId");
  const targetStatus = readField(form, "targetStatus") === "attended" ? "attended" : "booked";
  const reason = readField(form, "reason");

  const result = await correctAttendance(shiftId, personId, targetStatus, reason);
  revalidateAttendancePaths(shiftId);

  const status = result.ok ? (targetStatus === "booked" ? "reverted" : "confirmed") : result.error;
  redirect(`/admin/attendance/${encodeURIComponent(shiftId)}?manual=${encodeURIComponent(status)}`);
}
