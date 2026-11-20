"use server";

import { redirect } from "next/navigation";
import { reserveMyShift } from "../../../server/activities/portal";

export async function reserveActivityShift(activityId: string, formData: FormData) {
  const result = await reserveMyShift(activityId, formData.get("shiftId"));
  redirect(`/activities/${encodeURIComponent(activityId)}?status=${result}`);
}
