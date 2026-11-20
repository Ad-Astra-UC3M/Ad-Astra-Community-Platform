"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PublishStatus } from "../../../db/schema";
import {
  type AdminActivityImageInput,
  addActivityImage,
  addActivityShift,
  createAdminActivity,
  deleteShift,
  setActivityStatus,
  updateShiftCapacity,
} from "../../../server/activities/admin";

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
  const title = readField(form, "title");
  const description = readField(form, "description");
  const location = readField(form, "location");
  const rawStatus = readField(form, "status");
  const status: PublishStatus = rawStatus === "draft" ? "draft" : "published";

  const shiftName = readField(form, "shiftName");
  const startsAt = parseTimestamp(readField(form, "startsAt"));
  const endsAt = parseTimestamp(readField(form, "endsAt"));
  const rawCapacity = readField(form, "capacity");
  const capacity = rawCapacity === "" ? null : Number.parseInt(rawCapacity, 10);

  const images: AdminActivityImageInput[] = [];
  for (const pos of [1, 2]) {
    const url = readField(form, `imageUrl${pos}`);
    const alt = readField(form, `imageAlt${pos}`);
    if (url || alt) {
      images.push({ imageUrl: url, imageAlt: alt, position: images.length + 1 });
    }
  }

  const result = await createAdminActivity(
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
  );

  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/activities?status=created");
}

export async function addActivityShiftAction(form: FormData) {
  const activityId = readField(form, "activityId");
  const name = readField(form, "name");
  const startsAt = parseTimestamp(readField(form, "startsAt"));
  const endsAt = parseTimestamp(readField(form, "endsAt"));
  const rawCapacity = readField(form, "capacity");
  const capacity = rawCapacity === "" ? null : Number.parseInt(rawCapacity, 10);

  const result = await addActivityShift(activityId, {
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
  const activityId = readField(form, "activityId");
  const imageUrl = readField(form, "imageUrl");
  const imageAlt = readField(form, "imageAlt");
  const position = Number.parseInt(readField(form, "position"), 10);

  const result = await addActivityImage(activityId, {
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
  const shiftId = readField(form, "shiftId");
  const rawCapacity = readField(form, "capacity");
  const capacity = rawCapacity === "" ? null : Number.parseInt(rawCapacity, 10);

  const result = await updateShiftCapacity(shiftId, capacity);
  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/activities?status=capacity_updated");
}

export async function deleteShiftAction(form: FormData) {
  const shiftId = readField(form, "shiftId");

  const result = await deleteShift(shiftId);
  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/activities?status=shift_deleted");
}

export async function setActivityStatusAction(form: FormData) {
  const activityId = readField(form, "activityId");
  const rawStatus = readField(form, "status");
  const status: PublishStatus =
    rawStatus === "draft" || rawStatus === "archived" ? rawStatus : "published";

  const result = await setActivityStatus(activityId, status);
  revalidateActivityPaths();
  if (!result.ok) {
    redirect(`/admin/activities?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/admin/activities?status=activity_${status}`);
}
