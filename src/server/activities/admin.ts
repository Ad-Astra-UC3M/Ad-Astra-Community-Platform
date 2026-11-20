import "server-only";

import type { PublishStatus } from "../../db/schema";
import { requireCapability } from "../auth/access";
import * as data from "./admin-data";

export type { AdminActivityImageInput } from "./admin-data";

export async function listAdminActivities() {
  await requireCapability("content_editing");
  return data.listAdminActivities();
}

export async function createAdminActivity(input: data.CreateAdminActivityInput) {
  const editor = await requireCapability("content_editing");
  return data.createAdminActivity(input, editor.personId);
}

export async function addActivityShift(activityId: string, input: data.AdminShiftInput) {
  await requireCapability("content_editing");
  return data.addActivityShift(activityId, input);
}

export async function addActivityImage(activityId: string, input: data.AddActivityImageInput) {
  await requireCapability("content_editing");
  return data.addActivityImage(activityId, input);
}

export async function updateShiftCapacity(shiftId: string, capacity: number | null) {
  await requireCapability("content_editing");
  return data.updateShiftCapacity(shiftId, capacity);
}

export async function deleteShift(shiftId: string) {
  await requireCapability("content_editing");
  return data.deleteShift(shiftId);
}

export async function setActivityStatus(activityId: string, status: PublishStatus) {
  const editor = await requireCapability("content_editing");
  return data.setActivityStatus(activityId, status, editor.personId);
}
