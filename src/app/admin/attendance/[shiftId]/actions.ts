"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkIn } from "../../../../demo/activities";
import {
  correctAttendance,
  isAccountDeactivated,
  manualConfirmAttendance,
  registerAtDoor,
} from "../../../../demo/admin";
import { readCard } from "../../../../demo/card";
import { requireCapability } from "../../access";

const messages = {
  recorded: "Asistencia registrada.",
  already: "Ya registrado.",
  missing: "Esta persona no tiene reserva en el turno seleccionado.",
};

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function validateCard(shiftId: string, _previous: string, form: FormData) {
  const organizer = await requireCapability("attendance_validation");
  const token = form.get("token");
  const person = typeof token === "string" && (await readCard(organizer.workspaceId, token.trim()));
  if (!person) return "Tarjeta no válida para esta demostración.";
  if (isAccountDeactivated(organizer.workspaceId, person)) {
    return "La cuenta está desactivada y no puede validar asistencia.";
  }
  const result = checkIn(organizer.workspaceId, shiftId, person, organizer.id);
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

  const result = registerAtDoor(organizer.workspaceId, shiftId, targetAccountId, organizer.id, reason);
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

  const result = manualConfirmAttendance(organizer.workspaceId, shiftId, personId, organizer.id, reason);
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

  const result = correctAttendance(
    organizer.workspaceId,
    shiftId,
    personId,
    targetStatus,
    organizer.id,
    reason,
  );
  revalidatePath(`/admin/attendance/${encodeURIComponent(shiftId)}`);
  revalidatePath("/admin");
  revalidatePath("/my-activities");

  const status = result.ok ? (targetStatus === "booked" ? "reverted" : "confirmed") : result.error;
  redirect(`/admin/attendance/${encodeURIComponent(shiftId)}?manual=${encodeURIComponent(status)}`);
}
