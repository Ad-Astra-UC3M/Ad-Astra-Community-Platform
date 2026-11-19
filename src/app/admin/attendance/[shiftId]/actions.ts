"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkIn, type CheckInResult } from "../../../../server/repositories/activities";
import {
  correctAttendance,
  isAccountDeactivated,
  manualConfirmAttendance,
  registerAtDoor,
} from "../../../../server/repositories/admin";
import { verifyCard } from "../../../../server/services/attendance-card";
import { requireCapability } from "../../access";

const messages: Record<CheckInResult, string> = {
  recorded: "Asistencia registrada.",
  already: "Ya registrado.",
  deactivated: "La cuenta está desactivada y no puede validar asistencia.",
  missing: "Esta persona no tiene reserva en el turno seleccionado.",
};

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function validateCard(shiftId: string, _previous: string, form: FormData) {
  const organizer = await requireCapability("attendance_validation");
  const token = form.get("token");
  const personId = typeof token === "string" ? await verifyCard(token.trim()) : null;
  if (!personId) return "Tarjeta no válida o revocada.";
  if (await isAccountDeactivated(personId)) {
    return "La cuenta está desactivada y no puede validar asistencia.";
  }
  const result = await checkIn(shiftId, personId, organizer.personId);
  revalidatePath(`/admin/attendance/${encodeURIComponent(shiftId)}`);
  revalidatePath("/admin");
  revalidatePath("/my-activities");
  return messages[result];
}

export async function registerAtDoorAction(form: FormData) {
  const organizer = await requireCapability("attendance_validation");
  const shiftId = readField(form, "shiftId");
  const targetAccountId = readField(form, "targetAccountId");
  const reason = readField(form, "reason");

  const result = await registerAtDoor(shiftId, targetAccountId, organizer.personId, reason);
  revalidatePath(`/admin/attendance/${encodeURIComponent(shiftId)}`);
  revalidatePath("/admin");
  revalidatePath("/my-activities");

  const status = result.ok ? "registered" : result.error;
  redirect(`/admin/attendance/${encodeURIComponent(shiftId)}?door=${encodeURIComponent(status)}`);
}

export async function confirmManualAttendanceAction(form: FormData) {
  const organizer = await requireCapability("attendance_validation");
  const shiftId = readField(form, "shiftId");
  const personId = readField(form, "personId");
  const reason = readField(form, "reason");

  const result = await manualConfirmAttendance(shiftId, personId, organizer.personId, reason);
  revalidatePath(`/admin/attendance/${encodeURIComponent(shiftId)}`);
  revalidatePath("/admin");
  revalidatePath("/my-activities");

  const status = result.ok ? "confirmed" : result.error;
  redirect(`/admin/attendance/${encodeURIComponent(shiftId)}?manual=${encodeURIComponent(status)}`);
}

export async function correctAttendanceAction(form: FormData) {
  const organizer = await requireCapability("attendance_validation");
  const shiftId = readField(form, "shiftId");
  const personId = readField(form, "personId");
  const targetStatus = readField(form, "targetStatus") === "attended" ? "attended" : "booked";
  const reason = readField(form, "reason");

  const result = await correctAttendance(
    shiftId,
    personId,
    targetStatus,
    organizer.personId,
    reason,
  );
  revalidatePath(`/admin/attendance/${encodeURIComponent(shiftId)}`);
  revalidatePath("/admin");
  revalidatePath("/my-activities");

  const status = result.ok ? (targetStatus === "booked" ? "reverted" : "confirmed") : result.error;
  redirect(`/admin/attendance/${encodeURIComponent(shiftId)}?manual=${encodeURIComponent(status)}`);
}
