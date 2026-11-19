"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addActivityImage } from "../../../demo/activities";
import {
  type ActivityStatus,
  type AdminActivityImageInput,
  addActivityShift,
  createAdminActivity,
  deleteShift,
  setActivityStatus,
  updateShiftCapacity,
} from "../../../demo/admin";
import { requireCapability } from "../access";

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseTimestamp(raw: string): number {
  if (!raw) return Number.NaN;
  return Date.parse(raw);
}

function revalidateActivityPaths() {
  revalidatePath("/admin/activities");
  revalidatePath("/admin/attendance");
  revalidatePath("/admin");
  revalidatePath("/activities");
}

export async function createAdminActivityAction(form: FormData) {
  const editor = await requireCapability("content_editing");
  const title = readField(form, "title");
  const description = readField(form, "description");
  const location = readField(form, "location");
  const rawStatus = readField(form, "status");
  const status: ActivityStatus = rawStatus === "draft" ? "draft" : "published";

  const shiftName = readField(form, "shiftName");
  const startsAt = parseTimestamp(readField(form, "startsAt"));
  const endsAt = parseTimestamp(readField(form, "endsAt"));
  const capacity = Number.parseInt(readField(form, "capacity"), 10);

  const images: AdminActivityImageInput[] = [];
  for (const pos of [1, 2]) {
    const url = readField(form, `imageUrl${pos}`);
    const alt = readField(form, `imageAlt${pos}`);
    if (url || alt) {
      images.push({ imageUrl: url, imageAlt: alt, position: images.length + 1 });
    }
  }

  const result = createAdminActivity(
    editor.workspaceId,
    {
      title,
      description,
      location,
      status,
      ...(shiftName
        ? { shifts: [{ name: shiftName, startsAt, endsAt, capacity }] }
        : { startsAt, endsAt, capacity }),
      images,
    },
    editor.id,
  );

  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/activities?status=created");
}

export async function addActivityShiftAction(form: FormData) {
  const editor = await requireCapability("content_editing");
  const activityId = readField(form, "activityId");
  const name = readField(form, "name");
  const startsAt = parseTimestamp(readField(form, "startsAt"));
  const endsAt = parseTimestamp(readField(form, "endsAt"));
  const capacity = Number.parseInt(readField(form, "capacity"), 10);

  const result = addActivityShift(editor.workspaceId, activityId, {
    name,
    startsAt,
    endsAt,
    capacity,
  });

  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/activities?status=shift_added");
}

export async function addActivityImageAction(form: FormData) {
  const editor = await requireCapability("content_editing");
  const activityId = readField(form, "activityId");
  const imageUrl = readField(form, "imageUrl");
  const imageAlt = readField(form, "imageAlt");
  const position = Number.parseInt(readField(form, "position"), 10);

  const result = addActivityImage(editor.workspaceId, activityId, {
    imageUrl,
    imageAlt,
    position,
  });

  revalidateActivityPaths();
  if (result !== "saved") {
    redirect(`/admin/activities?error=${encodeURIComponent(result)}`);
  }
  redirect("/admin/activities?status=image_added");
}

export async function updateShiftCapacityAction(form: FormData) {
  const editor = await requireCapability("content_editing");
  const shiftId = readField(form, "shiftId");
  const capacity = Number.parseInt(readField(form, "capacity"), 10);

  const result = updateShiftCapacity(editor.workspaceId, shiftId, capacity);
  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/activities?status=capacity_updated");
}

export async function deleteShiftAction(form: FormData) {
  const editor = await requireCapability("content_editing");
  const shiftId = readField(form, "shiftId");

  const result = deleteShift(editor.workspaceId, shiftId);
  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/activities?status=shift_deleted");
}

export async function setActivityStatusAction(form: FormData) {
  const editor = await requireCapability("content_editing");
  const activityId = readField(form, "activityId");
  const rawStatus = readField(form, "status");
  const status: ActivityStatus =
    rawStatus === "draft" || rawStatus === "archived" ? rawStatus : "published";

  const result = setActivityStatus(editor.workspaceId, activityId, status, editor.id);
  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/admin/activities?status=activity_${status}`);
}
