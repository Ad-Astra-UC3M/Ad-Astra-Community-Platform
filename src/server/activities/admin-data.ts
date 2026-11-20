import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { AppDb, AppDbOrTx } from "../../db/client";
import {
  PUBLISH_STATUSES,
  activities,
  activityImages,
  adminAuditLogs,
  participationEvents,
  participations,
  shifts,
  type PublishStatus,
} from "../../db/schema";
import { isUuid, profileExists } from "../profiles/identity";
import { computeAvailable, resolveDb } from "./shared";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const publishStatusSchema = z.enum(PUBLISH_STATUSES);

const httpsUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && parsed.hostname.length > 0;
    } catch {
      return false;
    }
  });

const imageAltSchema = z.string().trim().min(1).max(240);
const positivePositionSchema = z.number().int().min(1);

export interface AdminActivityImage {
  id: string;
  imageUrl: string;
  imageAlt: string;
  position: number;
}

export interface AdminActivityImageInput {
  imageUrl: string;
  imageAlt: string;
  position?: number;
}

export interface AdminShiftInput {
  name?: string;
  startsAt: Date | number;
  endsAt: Date | number;
  capacity?: number | null;
  locationOverride?: string | null;
}

export interface CreateAdminActivityInput {
  slug?: string;
  title: string;
  description: string;
  location: string;
  externalRegistrationUrl?: string | null;
  status?: PublishStatus;
  startsAt?: Date | number;
  endsAt?: Date | number;
  capacity?: number | null;
  locationOverride?: string | null;
  shifts?: AdminShiftInput[];
  images?: AdminActivityImageInput[];
}

export interface AdminActivityShift {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  locationOverride: string | null;
  reservedCount: number;
  attendedCount: number;
  available: number | null;
}

export interface AdminActivity {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  externalRegistrationUrl: string | null;
  status: PublishStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  shifts: AdminActivityShift[];
  images: AdminActivityImage[];
}

export type CreateAdminActivityResult =
  | { ok: true; activity: AdminActivity }
  | {
      ok: false;
      error:
        | "missing_actor"
        | "missing_fields"
        | "invalid_status"
        | "invalid_slug"
        | "duplicate_slug"
        | "invalid_external_url"
        | "no_valid_shifts"
        | "invalid_schedule"
        | "invalid_capacity"
        | "invalid_image_url"
        | "missing_image_alt"
        | "invalid_image_position";
    };

export type AddActivityImageInput = {
  imageUrl: string;
  imageAlt: string;
  position: number;
};

export type AddActivityImageResult =
  | "saved"
  | "invalid_url"
  | "missing_alt"
  | "invalid_position"
  | "duplicate_position"
  | "missing_activity";

function toValidDate(value: Date | number | undefined | null): Date | null {
  if (value === undefined || value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function cleanOptionalText(
  value: string | null | undefined,
  maxLength?: number,
): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (maxLength !== undefined && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

function isValidHttpsUrl(raw: string): boolean {
  if (!raw || raw.length > 2048 || /[\s\u0000-\u001f]/.test(raw)) {
    return false;
  }
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function parseOptionalHttpsUrl(
  value: string | null | undefined,
): { valid: true; url: string | null } | { valid: false } {
  const trimmed = cleanOptionalText(value);
  if (!trimmed) return { valid: true, url: null };
  return isValidHttpsUrl(trimmed)
    ? { valid: true, url: trimmed }
    : { valid: false };
}

function generateSlug(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const prefix = base || "item";
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function normalizeExplicitSlug(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized.length > 100 || !SLUG_REGEX.test(normalized)) {
    return null;
  }
  return normalized;
}

function isPgErrorCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== "object") return false;
  const direct = (error as { code?: unknown }).code;
  if (direct === code) return true;
  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    return (cause as { code?: unknown }).code === code;
  }
  return false;
}

async function readAdminActivityShifts(
  db: AppDbOrTx,
  activityIds: string[],
): Promise<Map<string, AdminActivityShift[]>> {
  const byActivity = new Map<string, AdminActivityShift[]>();
  if (activityIds.length === 0) return byActivity;

  const rows = await db
    .select({
      id: shifts.id,
      activityId: shifts.activityId,
      name: shifts.name,
      startsAt: shifts.startsAt,
      endsAt: shifts.endsAt,
      capacity: shifts.capacity,
      locationOverride: shifts.locationOverride,
      reservedCount: sql<number>`COUNT(${participations.id})::int`,
      attendedCount: sql<number>`COUNT(${participations.id}) FILTER (WHERE ${participations.status} = 'attended')::int`,
    })
    .from(shifts)
    .leftJoin(participations, eq(participations.shiftId, shifts.id))
    .where(inArray(shifts.activityId, activityIds))
    .groupBy(shifts.id)
    .orderBy(asc(shifts.startsAt), asc(shifts.id));

  for (const row of rows) {
    const list = byActivity.get(row.activityId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      capacity: row.capacity,
      locationOverride: row.locationOverride ?? null,
      reservedCount: row.reservedCount,
      attendedCount: row.attendedCount,
      available: computeAvailable(row.capacity, row.reservedCount),
    });
    byActivity.set(row.activityId, list);
  }

  return byActivity;
}

async function readAdminActivityImages(
  db: AppDbOrTx,
  activityIds: string[],
): Promise<Map<string, AdminActivityImage[]>> {
  const byActivity = new Map<string, AdminActivityImage[]>();
  if (activityIds.length === 0) return byActivity;

  const rows = await db
    .select()
    .from(activityImages)
    .where(inArray(activityImages.activityId, activityIds))
    .orderBy(asc(activityImages.position), asc(activityImages.id));

  for (const row of rows) {
    const list = byActivity.get(row.activityId) ?? [];
    list.push({
      id: row.id,
      imageUrl: row.imageUrl,
      imageAlt: row.imageAlt,
      position: row.position,
    });
    byActivity.set(row.activityId, list);
  }

  return byActivity;
}

export async function listAdminActivities(
  db?: AppDb,
): Promise<AdminActivity[]> {
  const database = await resolveDb(db);
  const rows = await database
    .select()
    .from(activities)
    .orderBy(
      sql`CASE ${activities.status} WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END`,
      asc(activities.title),
      asc(activities.id),
    );

  const ids = rows.map((row) => row.id);
  const [shiftsByActivity, imagesByActivity] = await Promise.all([
    readAdminActivityShifts(database, ids),
    readAdminActivityImages(database, ids),
  ]);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    location: row.location,
    externalRegistrationUrl: row.externalRegistrationUrl ?? null,
    status: row.status,
    publishedAt: row.publishedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    shifts: shiftsByActivity.get(row.id) ?? [],
    images: imagesByActivity.get(row.id) ?? [],
  }));
}

export async function createAdminActivity(
  input: CreateAdminActivityInput,
  actorProfileId: string,
  db?: AppDb,
): Promise<CreateAdminActivityResult> {
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }

  const title = input.title?.trim() ?? "";
  const description = input.description?.trim() ?? "";
  const location = input.location?.trim() ?? "";
  if (
    !title ||
    title.length > 160 ||
    !description ||
    !location ||
    location.length > 200
  ) {
    return { ok: false, error: "missing_fields" };
  }

  const parsedStatus = publishStatusSchema.safeParse(
    input.status ?? "published",
  );
  if (!parsedStatus.success) {
    return { ok: false, error: "invalid_status" };
  }
  const status = parsedStatus.data;

  const externalUrl = parseOptionalHttpsUrl(input.externalRegistrationUrl);
  if (!externalUrl.valid) {
    return { ok: false, error: "invalid_external_url" };
  }

  const slug =
    input.slug !== undefined
      ? normalizeExplicitSlug(input.slug)
      : generateSlug(title);
  if (!slug) {
    return { ok: false, error: "invalid_slug" };
  }

  const rawShifts: AdminShiftInput[] =
    input.shifts !== undefined
      ? input.shifts
      : [
          {
            name: "normal",
            startsAt: input.startsAt ?? Number.NaN,
            endsAt: input.endsAt ?? Number.NaN,
            capacity: input.capacity === undefined ? 0 : input.capacity,
            locationOverride: input.locationOverride,
          },
        ];

  if (status === "published" && rawShifts.length === 0) {
    return { ok: false, error: "no_valid_shifts" };
  }

  const normalizedShifts: Array<{
    name: string;
    startsAt: Date;
    endsAt: Date;
    capacity: number | null;
    locationOverride: string | null;
  }> = [];

  for (const shift of rawShifts) {
    const startsAt = toValidDate(shift.startsAt);
    const endsAt = toValidDate(shift.endsAt);
    if (!startsAt || !endsAt || endsAt.getTime() <= startsAt.getTime()) {
      return { ok: false, error: "invalid_schedule" };
    }
    const capacity = shift.capacity === undefined ? null : shift.capacity;
    if (
      capacity !== null &&
      (!Number.isInteger(capacity) || capacity <= 0)
    ) {
      return { ok: false, error: "invalid_capacity" };
    }
    normalizedShifts.push({
      name: (shift.name?.trim() || "normal").slice(0, 100),
      startsAt,
      endsAt,
      capacity,
      locationOverride: cleanOptionalText(shift.locationOverride, 200),
    });
  }

  const normalizedImages: Array<{
    imageUrl: string;
    imageAlt: string;
    position: number;
  }> = [];
  const usedPositions = new Set<number>();

  for (let index = 0; index < (input.images ?? []).length; index++) {
    const item = input.images![index];
    const imageUrl = item.imageUrl?.trim() ?? "";
    const imageAlt = item.imageAlt?.trim() ?? "";
    const position = item.position ?? index + 1;
    if (!isValidHttpsUrl(imageUrl)) {
      return { ok: false, error: "invalid_image_url" };
    }
    if (!imageAlt || imageAlt.length > 240) {
      return { ok: false, error: "missing_image_alt" };
    }
    if (
      !Number.isInteger(position) ||
      position < 1 ||
      usedPositions.has(position)
    ) {
      return { ok: false, error: "invalid_image_position" };
    }
    usedPositions.add(position);
    normalizedImages.push({ imageUrl, imageAlt, position });
  }

  const database = await resolveDb(db);
  const now = new Date();

  return database.transaction(async (tx) => {
    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    const [existingSlug] = await tx
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.slug, slug))
      .limit(1);
    if (existingSlug) {
      return { ok: false, error: "duplicate_slug" };
    }

    const [insertedActivity] = await tx
      .insert(activities)
      .values({
        slug,
        title,
        description,
        location,
        externalRegistrationUrl: externalUrl.url,
        status,
        createdBy: actorProfileId,
        publishedAt: status === "published" ? now : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (normalizedShifts.length > 0) {
      await tx.insert(shifts).values(
        normalizedShifts.map((shift) => ({
          activityId: insertedActivity.id,
          name: shift.name,
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
          capacity: shift.capacity,
          locationOverride: shift.locationOverride,
        })),
      );
    }

    if (normalizedImages.length > 0) {
      await tx.insert(activityImages).values(
        normalizedImages.map((img) => ({
          activityId: insertedActivity.id,
          imageUrl: img.imageUrl,
          imageAlt: img.imageAlt,
          position: img.position,
        })),
      );
    }

    await tx.insert(adminAuditLogs).values({
      actorProfileId,
      targetType: "activity",
      targetId: insertedActivity.id,
      action: "activity_created",
      result: "success",
      metadata: {
        slug,
        status,
        shiftCount: normalizedShifts.length,
        imageCount: normalizedImages.length,
      },
    });

    const [shiftsMap, imagesMap] = await Promise.all([
      readAdminActivityShifts(tx, [insertedActivity.id]),
      readAdminActivityImages(tx, [insertedActivity.id]),
    ]);

    return {
      ok: true,
      activity: {
        id: insertedActivity.id,
        slug: insertedActivity.slug,
        title: insertedActivity.title,
        description: insertedActivity.description,
        location: insertedActivity.location,
        externalRegistrationUrl:
          insertedActivity.externalRegistrationUrl ?? null,
        status: insertedActivity.status,
        publishedAt: insertedActivity.publishedAt ?? null,
        createdAt: insertedActivity.createdAt,
        updatedAt: insertedActivity.updatedAt,
        shifts: shiftsMap.get(insertedActivity.id) ?? [],
        images: imagesMap.get(insertedActivity.id) ?? [],
      },
    };
  });
}

export async function addActivityShift(
  activityId: string,
  input: AdminShiftInput,
  db?: AppDb,
): Promise<
  | { ok: true; shift: AdminActivityShift }
  | {
      ok: false;
      error: "missing_activity" | "invalid_schedule" | "invalid_capacity";
    }
> {
  if (!isUuid(activityId)) {
    return { ok: false, error: "missing_activity" };
  }

  const startsAt = toValidDate(input.startsAt);
  const endsAt = toValidDate(input.endsAt);
  if (!startsAt || !endsAt || endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "invalid_schedule" };
  }

  const capacity = input.capacity === undefined ? null : input.capacity;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
    return { ok: false, error: "invalid_capacity" };
  }

  const name = (input.name?.trim() || "normal").slice(0, 100);
  const locationOverride = cleanOptionalText(input.locationOverride, 200);
  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [activity] = await tx
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.id, activityId))
      .limit(1);
    if (!activity) return { ok: false, error: "missing_activity" };

    const [inserted] = await tx
      .insert(shifts)
      .values({
        activityId,
        name,
        startsAt,
        endsAt,
        capacity,
        locationOverride,
      })
      .returning();

    return {
      ok: true,
      shift: {
        id: inserted.id,
        name: inserted.name,
        startsAt: inserted.startsAt,
        endsAt: inserted.endsAt,
        capacity: inserted.capacity,
        locationOverride: inserted.locationOverride ?? null,
        reservedCount: 0,
        attendedCount: 0,
        available: inserted.capacity,
      },
    };
  });
}

export async function updateShiftCapacity(
  shiftId: string,
  newCapacity: number | null,
  db?: AppDb,
): Promise<
  | {
      ok: true;
      shiftId: string;
      capacity: number | null;
      reservedCount: number;
    }
  | { ok: false; error: "invalid_capacity" | "missing_shift" }
  | { ok: false; error: "below_reserved"; reservedCount: number }
> {
  if (
    newCapacity !== null &&
    (!Number.isInteger(newCapacity) || newCapacity <= 0)
  ) {
    return { ok: false, error: "invalid_capacity" };
  }
  if (!isUuid(shiftId)) {
    return { ok: false, error: "missing_shift" };
  }

  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [shift] = await tx
      .select({ id: shifts.id })
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .for("update");
    if (!shift) return { ok: false, error: "missing_shift" };

    const [{ reservedCount }] = await tx
      .select({ reservedCount: sql<number>`COUNT(*)::int` })
      .from(participations)
      .where(eq(participations.shiftId, shiftId));

    if (newCapacity !== null && newCapacity < reservedCount) {
      return { ok: false, error: "below_reserved", reservedCount };
    }

    await tx
      .update(shifts)
      .set({ capacity: newCapacity })
      .where(eq(shifts.id, shiftId));

    return { ok: true, shiftId, capacity: newCapacity, reservedCount };
  });
}

export async function deleteShift(
  shiftId: string,
  db?: AppDb,
): Promise<
  | { ok: true; shiftId: string }
  | { ok: false; error: "missing_shift" }
  | {
      ok: false;
      error: "has_participants";
      reservedCount: number;
      eventCount: number;
    }
> {
  if (!isUuid(shiftId)) {
    return { ok: false, error: "missing_shift" };
  }

  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [shift] = await tx
      .select({ id: shifts.id })
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .for("update");
    if (!shift) return { ok: false, error: "missing_shift" };

    const [{ reservedCount }] = await tx
      .select({ reservedCount: sql<number>`COUNT(*)::int` })
      .from(participations)
      .where(eq(participations.shiftId, shiftId));

    const [{ eventCount }] = await tx
      .select({ eventCount: sql<number>`COUNT(*)::int` })
      .from(participationEvents)
      .where(
        or(
          eq(participationEvents.shiftId, shiftId),
          eq(participationEvents.fromShiftId, shiftId),
        ),
      );

    if (reservedCount > 0 || eventCount > 0) {
      return {
        ok: false,
        error: "has_participants",
        reservedCount,
        eventCount,
      };
    }

    await tx.delete(shifts).where(eq(shifts.id, shiftId));
    return { ok: true, shiftId };
  });
}

export async function setActivityStatus(
  activityId: string,
  status: PublishStatus,
  actorProfileId: string,
  db?: AppDb,
): Promise<
  | { ok: true; activityId: string; status: PublishStatus }
  | {
      ok: false;
      error:
        | "invalid_status"
        | "missing_actor"
        | "missing_activity"
        | "no_valid_shifts";
    }
> {
  const parsedStatus = publishStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { ok: false, error: "invalid_status" };
  }
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }
  if (!isUuid(activityId)) {
    return { ok: false, error: "missing_activity" };
  }

  const database = await resolveDb(db);
  const now = new Date();

  return database.transaction(async (tx) => {
    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    const [activity] = await tx
      .select()
      .from(activities)
      .where(eq(activities.id, activityId))
      .for("update");
    if (!activity) return { ok: false, error: "missing_activity" };

    if (parsedStatus.data === "published") {
      const [{ count }] = await tx
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(shifts)
        .where(
          and(
            eq(shifts.activityId, activityId),
            sql`${shifts.endsAt} > ${shifts.startsAt}`,
            sql`(${shifts.capacity} IS NULL OR ${shifts.capacity} > 0)`,
          ),
        );
      if (count === 0) {
        return { ok: false, error: "no_valid_shifts" };
      }
    }

    await tx
      .update(activities)
      .set({
        status: parsedStatus.data,
        publishedAt:
          parsedStatus.data === "published"
            ? (activity.publishedAt ?? now)
            : activity.publishedAt,
        updatedAt: now,
      })
      .where(eq(activities.id, activityId));

    await tx.insert(adminAuditLogs).values({
      actorProfileId,
      targetType: "activity",
      targetId: activityId,
      action: "activity_status_updated",
      result: "success",
      metadata: {
        previousStatus: activity.status,
        status: parsedStatus.data,
      },
    });

    return { ok: true, activityId, status: parsedStatus.data };
  });
}

export async function addActivityImage(
  activityId: string,
  input: AddActivityImageInput,
  db?: AppDb,
): Promise<AddActivityImageResult> {
  const urlParsed = httpsUrlSchema.safeParse(input.imageUrl);
  if (!urlParsed.success) return "invalid_url";

  const altParsed = imageAltSchema.safeParse(input.imageAlt);
  if (!altParsed.success) return "missing_alt";

  const posParsed = positivePositionSchema.safeParse(input.position);
  if (!posParsed.success) return "invalid_position";

  const key = activityId.trim();
  if (!key) return "missing_activity";

  const conn = await resolveDb(db);
  const identifierCondition = isUuid(key)
    ? or(eq(activities.id, key), eq(activities.slug, key))
    : eq(activities.slug, key);

  try {
    return await conn.transaction(async (tx) => {
      const [activity] = await tx
        .select({ id: activities.id })
        .from(activities)
        .where(identifierCondition)
        .limit(1);

      if (!activity) return "missing_activity";

      const [existing] = await tx
        .select({ id: activityImages.id })
        .from(activityImages)
        .where(
          and(
            eq(activityImages.activityId, activity.id),
            eq(activityImages.position, posParsed.data),
          ),
        )
        .limit(1);

      if (existing) return "duplicate_position";

      await tx.insert(activityImages).values({
        activityId: activity.id,
        imageUrl: urlParsed.data,
        imageAlt: altParsed.data,
        position: posParsed.data,
      });

      return "saved";
    });
  } catch (error) {
    if (isPgErrorCode(error, "23505")) {
      return "duplicate_position";
    }
    throw error;
  }
}
