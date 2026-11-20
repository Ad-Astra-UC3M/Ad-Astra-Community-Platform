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

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateAttendancePaths(shiftId: string) {
  revalidatePath(`/admin/attendance/${encodeURIComponent(shiftId)}`);
  revalidatePath("/admin");
  revalidatePath("/my-activities");
}

export async function validateCard(shiftId: string, _previous: string, form: FormData) {
  const result = await validateAttendanceCard(shiftId, form.get("token"));
  if (result !== "invalid_card") revalidateAttendancePaths(shiftId);
  return messages[result];
}

export async function registerAtDoorAction(form: FormData) {
  const shiftId = readField(form, "shiftId");
  const targetAccountId = readField(form, "targetAccountId");
  const reason = readField(form, "reason");

  const result = await registerAtDoor(shiftId, targetAccountId, reason);
  revalidateAttendancePaths(shiftId);

  const status = result.ok ? "registered" : result.error;
  redirect(`/admin/attendance/${encodeURIComponent(shiftId)}?door=${encodeURIComponent(status)}`);
}

export async function confirmManualAttendanceAction(form: FormData) {
  const shiftId = readField(form, "shiftId");
  const personId = readField(form, "personId");
  const reason = readField(form, "reason");

  const result = await manualConfirmAttendance(shiftId, personId, reason);
  revalidateAttendancePaths(shiftId);

  const status = result.ok ? "confirmed" : result.error;
  redirect(`/admin/attendance/${encodeURIComponent(shiftId)}?manual=${encodeURIComponent(status)}`);
}

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
