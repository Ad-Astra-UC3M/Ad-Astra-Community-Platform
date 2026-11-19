"use server";

import { redirect } from "next/navigation";
import { requireUser } from "../../../lib/auth/session";
import { reserveShift } from "../../../server/repositories/activities";

export async function reserveActivityShift(activityId: string, formData: FormData) {
  const user = await requireUser();
  const shiftId = formData.get("shiftId");
  const result =
    typeof shiftId === "string" && shiftId
      ? await reserveShift(activityId, shiftId, user.personId)
      : "missing";

  redirect(`/activities/${encodeURIComponent(activityId)}?status=${result}`);
}
