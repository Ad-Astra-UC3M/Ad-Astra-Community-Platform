"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "../../access";
import { checkIn } from "../../../../demo/activities";
import { readCard } from "../../../../demo/card";

const messages = {
  recorded: "Asistencia registrada.",
  already: "Ya registrado.",
  missing: "Esta persona no tiene reserva en el turno seleccionado."
};

export async function validateCard(shiftId: string, _previous: string, form: FormData) {
  const organizer = await requireOrganizer();
  const token = form.get("token");
  const person = typeof token === "string" && await readCard(organizer.workspaceId, token.trim());
  if (!person) return "Tarjeta no válida para esta demostración.";
  const result = checkIn(organizer.workspaceId, shiftId, person, organizer.id);
  revalidatePath(`/admin/attendance/${encodeURIComponent(shiftId)}`);
  revalidatePath("/my-activities");
  return messages[result];
}
