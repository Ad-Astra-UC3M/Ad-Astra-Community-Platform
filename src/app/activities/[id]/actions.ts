"use server";

import { redirect } from "next/navigation";
import { reserveShift } from "../../../demo/activities";
import { requireUser } from "../../../demo/session";

export async function reserveActivityShift(activityId: string, formData: FormData) {
  const user = await requireUser();
  const shiftId = formData.get("shiftId");
  const result = typeof shiftId === "string" && shiftId
    ? reserveShift(user.workspaceId, activityId, shiftId, user)
    : "missing";

  redirect(`/activities/${encodeURIComponent(activityId)}?status=${result}`);
}
