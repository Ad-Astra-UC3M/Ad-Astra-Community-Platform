"use server";

import { redirect } from "next/navigation";
import { cancelReservation, changeReservation } from "../../demo/activities";
import { requireUser } from "../../demo/session";

export async function cancelActivityReservation(formData: FormData) {
  const user = await requireUser();
  const shiftId = formData.get("shiftId");
  const result = typeof shiftId === "string" && shiftId
    ? cancelReservation(user.workspaceId, user.id, shiftId)
    : "missing";

  redirect(`/my-activities?status=${result}`);
}

export async function changeActivityShift(formData: FormData) {
  const user = await requireUser();
  const fromShiftId = formData.get("fromShiftId");
  const toShiftId = formData.get("toShiftId");
  const result = typeof fromShiftId === "string" && fromShiftId && typeof toShiftId === "string" && toShiftId
    ? changeReservation(user.workspaceId, user.id, fromShiftId, toShiftId)
    : "missing";

  redirect(`/my-activities?status=${result}`);
}
