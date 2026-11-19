"use server";

import { redirect } from "next/navigation";
import { requireUser } from "../../lib/auth/session";
import { cancelReservation, changeReservation } from "../../server/repositories/activities";

export async function cancelActivityReservation(formData: FormData) {
  const user = await requireUser();
  const shiftId = formData.get("shiftId");
  const result =
    typeof shiftId === "string" && shiftId
      ? await cancelReservation(user.personId, shiftId)
      : "missing";

  redirect(`/my-activities?status=${result}`);
}

export async function changeActivityShift(formData: FormData) {
  const user = await requireUser();
  const fromShiftId = formData.get("fromShiftId");
  const toShiftId = formData.get("toShiftId");
  const result =
    typeof fromShiftId === "string" &&
    fromShiftId &&
    typeof toShiftId === "string" &&
    toShiftId
      ? await changeReservation(user.personId, fromShiftId, toShiftId)
      : "missing";

  redirect(`/my-activities?status=${result}`);
}
