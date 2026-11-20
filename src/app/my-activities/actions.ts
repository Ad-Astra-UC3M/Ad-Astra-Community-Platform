"use server";

import { redirect } from "next/navigation";
import { cancelMyReservation, changeMyReservation } from "../../server/activities/portal";

export async function cancelActivityReservation(formData: FormData) {
  const result = await cancelMyReservation(formData.get("shiftId"));
  redirect(`/my-activities?status=${result}`);
}

export async function changeActivityShift(formData: FormData) {
  const result = await changeMyReservation(formData.get("fromShiftId"), formData.get("toShiftId"));
  redirect(`/my-activities?status=${result}`);
}
