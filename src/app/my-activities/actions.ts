"use server";

import { redirect } from "next/navigation";
import { cancelReservation } from "../../demo/activities";
import { requireUser } from "../../demo/session";

export async function cancelActivityReservation(formData: FormData) {
  const user = await requireUser();
  const shiftId = formData.get("shiftId");
  const result = typeof shiftId === "string" && shiftId
    ? cancelReservation(user.workspaceId, user.id, shiftId)
    : "missing";

  redirect(`/my-activities?status=${result}`);
}
