import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, type AppDb, type AppDbOrTx } from "../../db/client";
import {
  activities,
  activityImages,
  participationEvents,
  participations,
  profiles,
  shifts,
  type ParticipationStatus,
} from "../../db/schema";

export type BookingStatus = ParticipationStatus;

export type ActivityImage = {
  id: string;
  imageUrl: string;
  imageAlt: string;
  position: number;
};

export type Shift = {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  reservedCount: number;
  available: number | null;
  locationOverride: string | null;
  booking: BookingStatus | null;
};

export type ActivitySummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  externalRegistrationUrl: string | null;
  publishedAt: Date | null;
};

export type Activity = ActivitySummary & {
  shifts: Shift[];
  images: ActivityImage[];
  coverImage: ActivityImage | null;
};

export type ChangeTargetShift = {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  available: number | null;
  locationOverride: string | null;
};

export type Reservation = {
  participationId: string;
  shiftId: string;
  shiftName: string;
  activityId: string;
  activitySlug: string;
  activityTitle: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  canCancel: boolean;
  otherShifts: ChangeTargetShift[];
};

export type ShiftListItem = {
  id: string;
  activityId: string;
  activitySlug: string;
  activityTitle: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  locationOverride: string | null;
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

export type ReserveShiftResult =
  | "reserved"
  | "duplicate"
  | "full"
  | "closed"
  | "missing"
  | "deactivated";

export type CancelReservationResult =
  | "cancelled"
  | "attended"
  | "closed"
  | "missing";

export type ChangeReservationResult =
  | "changed"
  | "same_shift"
  | "different_activity"
  | "duplicate"
  | "full"
  | "closed"
  | "attended"
  | "missing";

export type CheckInResult = "recorded" | "already" | "deactivated" | "missing";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
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

function computeAvailable(capacity: number | null, reservedCount: number): number | null {
  return capacity === null ? null : Math.max(0, capacity - reservedCount);
}

async function resolveDb(db?: AppDb): Promise<AppDb> {
  return db ?? (await getDb());
}

async function loadImagesByActivityIds(
  conn: AppDbOrTx,
  activityIds: string[],
): Promise<Map<string, ActivityImage[]>> {
  const byActivity = new Map<string, ActivityImage[]>();
  if (activityIds.length === 0) return byActivity;

  const rows = await conn
    .select({
      id: activityImages.id,
      activityId: activityImages.activityId,
      imageUrl: activityImages.imageUrl,
      imageAlt: activityImages.imageAlt,
      position: activityImages.position,
    })
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

async function loadShiftsByActivityIds(
  conn: AppDbOrTx,
  activityIds: string[],
  personId: string,
): Promise<Map<string, Shift[]>> {
  const byActivity = new Map<string, Shift[]>();
  if (activityIds.length === 0) return byActivity;

  const shiftRows = await conn
    .select({
      id: shifts.id,
      activityId: shifts.activityId,
      name: shifts.name,
      startsAt: shifts.startsAt,
      endsAt: shifts.endsAt,
      capacity: shifts.capacity,
      locationOverride: shifts.locationOverride,
    })
    .from(shifts)
    .where(inArray(shifts.activityId, activityIds))
    .orderBy(asc(shifts.startsAt), asc(shifts.id));

  if (shiftRows.length === 0) return byActivity;

  const shiftIds = shiftRows.map((row) => row.id);

  const countRows = await conn
    .select({
      shiftId: participations.shiftId,
      reservedCount: sql<number>`count(*)::int`,
    })
    .from(participations)
    .where(inArray(participations.shiftId, shiftIds))
    .groupBy(participations.shiftId);

  const counts = new Map<string, number>();
  for (const row of countRows) {
    counts.set(row.shiftId, Number(row.reservedCount));
  }

  const bookings = new Map<string, BookingStatus>();
  if (isUuid(personId)) {
    const bookingRows = await conn
      .select({
        shiftId: participations.shiftId,
        status: participations.status,
      })
      .from(participations)
      .where(
        and(
          eq(participations.personId, personId),
          inArray(participations.shiftId, shiftIds),
        ),
      );
    for (const row of bookingRows) {
      bookings.set(row.shiftId, row.status);
    }
  }

  for (const row of shiftRows) {
    const reservedCount = counts.get(row.id) ?? 0;
    const list = byActivity.get(row.activityId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      capacity: row.capacity,
      reservedCount,
      available: computeAvailable(row.capacity, reservedCount),
      locationOverride: row.locationOverride,
      booking: bookings.get(row.id) ?? null,
    });
    byActivity.set(row.activityId, list);
  }

  return byActivity;
}

export async function listActivities(
  personId: string,
  db?: AppDb,
): Promise<Activity[]> {
  const conn = await resolveDb(db);

  const activityRows = await conn
    .select({
      id: activities.id,
      slug: activities.slug,
      title: activities.title,
      description: activities.description,
      location: activities.location,
      externalRegistrationUrl: activities.externalRegistrationUrl,
      publishedAt: activities.publishedAt,
    })
    .from(activities)
    .where(eq(activities.status, "published"))
    .orderBy(asc(activities.title), asc(activities.id));

  if (activityRows.length === 0) return [];

  const activityIds = activityRows.map((row) => row.id);
  const [imagesByActivity, shiftsByActivity] = await Promise.all([
    loadImagesByActivityIds(conn, activityIds),
    loadShiftsByActivityIds(conn, activityIds, personId),
  ]);

  return activityRows.map((row) => {
    const images = imagesByActivity.get(row.id) ?? [];
    return {
      ...row,
      shifts: shiftsByActivity.get(row.id) ?? [],
      images,
      coverImage: images[0] ?? null,
    };
  });
}

export async function getActivity(
  activityIdOrSlug: string,
  personId: string,
  db?: AppDb,
): Promise<Activity | undefined> {
  const key = activityIdOrSlug.trim();
  if (!key) return undefined;

  const conn = await resolveDb(db);
  const identifierCondition = isUuid(key)
    ? or(eq(activities.id, key), eq(activities.slug, key))
    : eq(activities.slug, key);

  const [activityRow] = await conn
    .select({
      id: activities.id,
      slug: activities.slug,
      title: activities.title,
      description: activities.description,
      location: activities.location,
      externalRegistrationUrl: activities.externalRegistrationUrl,
      publishedAt: activities.publishedAt,
    })
    .from(activities)
    .where(and(identifierCondition, eq(activities.status, "published")))
    .limit(1);

  if (!activityRow) return undefined;

  const [imagesByActivity, shiftsByActivity] = await Promise.all([
    loadImagesByActivityIds(conn, [activityRow.id]),
    loadShiftsByActivityIds(conn, [activityRow.id], personId),
  ]);

  const images = imagesByActivity.get(activityRow.id) ?? [];
  return {
    ...activityRow,
    shifts: shiftsByActivity.get(activityRow.id) ?? [],
    images,
    coverImage: images[0] ?? null,
  };
}

export async function listShifts(db?: AppDb): Promise<ShiftListItem[]> {
  const conn = await resolveDb(db);

  return conn
    .select({
      id: shifts.id,
      activityId: activities.id,
      activitySlug: activities.slug,
      activityTitle: activities.title,
      name: shifts.name,
      startsAt: shifts.startsAt,
      endsAt: shifts.endsAt,
      capacity: shifts.capacity,
      locationOverride: shifts.locationOverride,
    })
    .from(shifts)
    .innerJoin(activities, eq(activities.id, shifts.activityId))
    .orderBy(asc(shifts.startsAt), asc(shifts.id));
}

export async function listReservations(
  personId: string,
  db?: AppDb,
  now: Date = new Date(),
): Promise<Reservation[]> {
  if (!isUuid(personId)) return [];

  const conn = await resolveDb(db);

  const rows = await conn
    .select({
      participationId: participations.id,
      shiftId: shifts.id,
      shiftName: shifts.name,
      activityId: activities.id,
      activitySlug: activities.slug,
      activityTitle: activities.title,
      activityLocation: activities.location,
      activityStatus: activities.status,
      locationOverride: shifts.locationOverride,
      startsAt: shifts.startsAt,
      endsAt: shifts.endsAt,
      status: participations.status,
    })
    .from(participations)
    .innerJoin(shifts, eq(shifts.id, participations.shiftId))
    .innerJoin(activities, eq(activities.id, shifts.activityId))
    .where(eq(participations.personId, personId))
    .orderBy(asc(shifts.startsAt), asc(shifts.id));

  if (rows.length === 0) return [];

  const nowMs = now.getTime();
  const modifiablePublishedActivityIds = Array.from(
    new Set(
      rows
        .filter(
          (row) =>
            row.status === "booked" &&
            row.startsAt.getTime() > nowMs &&
            row.activityStatus === "published",
        )
        .map((row) => row.activityId),
    ),
  );

  const shiftsByActivity = await loadShiftsByActivityIds(
    conn,
    modifiablePublishedActivityIds,
    personId,
  );

  return rows.map((row) => {
    const canCancel = row.status === "booked" && row.startsAt.getTime() > nowMs;
    const otherShifts: ChangeTargetShift[] =
      canCancel && row.activityStatus === "published"
        ? (shiftsByActivity.get(row.activityId) ?? [])
            .filter(
              (candidate) =>
                candidate.id !== row.shiftId &&
                candidate.booking === null &&
                candidate.startsAt.getTime() > nowMs &&
                (candidate.available === null || candidate.available > 0),
            )
            .map(
              ({
                id,
                name,
                startsAt,
                endsAt,
                capacity,
                available,
                locationOverride,
              }) => ({
                id,
                name,
                startsAt,
                endsAt,
                capacity,
                available,
                locationOverride,
              }),
            )
        : [];

    return {
      participationId: row.participationId,
      shiftId: row.shiftId,
      shiftName: row.shiftName,
      activityId: row.activityId,
      activitySlug: row.activitySlug,
      activityTitle: row.activityTitle,
      location: row.locationOverride ?? row.activityLocation,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      canCancel,
      otherShifts,
    };
  });
}

export async function reserveShift(
  activityIdOrSlug: string,
  shiftId: string,
  personId: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<ReserveShiftResult> {
  const activityKey = activityIdOrSlug.trim();
  if (!activityKey || !isUuid(shiftId) || !isUuid(personId)) {
    return "missing";
  }

  const conn = await resolveDb(db);

  return conn.transaction(async (tx) => {
    const [shift] = await tx
      .select({
        id: shifts.id,
        activityId: shifts.activityId,
        startsAt: shifts.startsAt,
        capacity: shifts.capacity,
      })
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .for("update");

    if (!shift) return "missing";

    const [activity] = await tx
      .select({
        id: activities.id,
        slug: activities.slug,
        status: activities.status,
      })
      .from(activities)
      .where(eq(activities.id, shift.activityId))
      .limit(1);

    if (!activity || (activity.id !== activityKey && activity.slug !== activityKey)) {
      return "missing";
    }

    const [profile] = await tx
      .select({ id: profiles.id, status: profiles.status })
      .from(profiles)
      .where(eq(profiles.id, personId))
      .limit(1);

    if (!profile) return "missing";
    if (profile.status !== "active") return "deactivated";

    if (activity.status !== "published") return "closed";
    if (shift.startsAt.getTime() <= now.getTime()) return "closed";

    const [existing] = await tx
      .select({ id: participations.id })
      .from(participations)
      .where(
        and(
          eq(participations.personId, personId),
          eq(participations.shiftId, shiftId),
        ),
      )
      .limit(1);

    if (existing) return "duplicate";

    if (shift.capacity !== null) {
      const [countRow] = await tx
        .select({ reservedCount: sql<number>`count(*)::int` })
        .from(participations)
        .where(eq(participations.shiftId, shiftId));
      const reservedCount = Number(countRow?.reservedCount ?? 0);
      if (reservedCount >= shift.capacity) return "full";
    }

    const [inserted] = await tx
      .insert(participations)
      .values({
        personId,
        shiftId,
        status: "booked",
        reservedAt: now,
        source: "portal",
      })
      .returning({ id: participations.id });

    await tx.insert(participationEvents).values({
      participationId: inserted.id,
      personId,
      actorProfileId: personId,
      shiftId,
      eventType: "reserved",
      createdAt: now,
    });

    return "reserved";
  });
}

export async function cancelReservation(
  personId: string,
  shiftId: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<CancelReservationResult> {
  if (!isUuid(personId) || !isUuid(shiftId)) {
    return "missing";
  }

  const conn = await resolveDb(db);

  return conn.transaction(async (tx) => {
    // Bloqueo determinista: primero shifts, después participations (spec §1.3.6)
    const [shift] = await tx
      .select({
        id: shifts.id,
        startsAt: shifts.startsAt,
      })
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .for("update");

    if (!shift) return "missing";

    const [participation] = await tx
      .select({
        id: participations.id,
        status: participations.status,
      })
      .from(participations)
      .where(
        and(
          eq(participations.personId, personId),
          eq(participations.shiftId, shiftId),
        ),
      )
      .for("update");

    if (!participation) return "missing";
    if (participation.status !== "booked") return "attended";
    if (shift.startsAt.getTime() <= now.getTime()) return "closed";

    const participationId = participation.id;

    await tx
      .delete(participations)
      .where(eq(participations.id, participationId));

    await tx.insert(participationEvents).values({
      participationId,
      personId,
      actorProfileId: personId,
      shiftId,
      eventType: "cancelled",
      createdAt: now,
    });

    return "cancelled";
  });
}

export async function changeReservation(
  personId: string,
  fromShiftId: string,
  toShiftId: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<ChangeReservationResult> {
  if (!fromShiftId || !toShiftId) return "missing";
  if (fromShiftId === toShiftId) return "same_shift";
  if (!isUuid(personId) || !isUuid(fromShiftId) || !isUuid(toShiftId)) {
    return "missing";
  }

  const conn = await resolveDb(db);

  return conn.transaction(async (tx) => {
    // Bloqueo determinista de ambos turnos por id ASC (spec §1.3.6)
    const lockedShifts = await tx
      .select({
        id: shifts.id,
        activityId: shifts.activityId,
        startsAt: shifts.startsAt,
        capacity: shifts.capacity,
      })
      .from(shifts)
      .where(inArray(shifts.id, [fromShiftId, toShiftId]))
      .orderBy(asc(shifts.id))
      .for("update");

    const fromShift = lockedShifts.find((row) => row.id === fromShiftId);
    const toShift = lockedShifts.find((row) => row.id === toShiftId);

    if (!fromShift) return "missing";

    const [sourceParticipation] = await tx
      .select({
        id: participations.id,
        status: participations.status,
      })
      .from(participations)
      .where(
        and(
          eq(participations.personId, personId),
          eq(participations.shiftId, fromShiftId),
        ),
      )
      .for("update");

    if (!sourceParticipation) return "missing";
    if (sourceParticipation.status !== "booked") return "attended";

    const [activity] = await tx
      .select({ id: activities.id, status: activities.status })
      .from(activities)
      .where(eq(activities.id, fromShift.activityId))
      .limit(1);

    if (!activity) return "missing";
    if (activity.status !== "published") return "closed";
    if (!toShift) return "missing";
    if (toShift.activityId !== fromShift.activityId) return "different_activity";

    if (fromShift.startsAt.getTime() <= now.getTime()) return "closed";
    if (toShift.startsAt.getTime() <= now.getTime()) return "closed";

    const [existingTarget] = await tx
      .select({ id: participations.id })
      .from(participations)
      .where(
        and(
          eq(participations.personId, personId),
          eq(participations.shiftId, toShiftId),
        ),
      )
      .limit(1);

    if (existingTarget) return "duplicate";

    if (toShift.capacity !== null) {
      const [countRow] = await tx
        .select({ reservedCount: sql<number>`count(*)::int` })
        .from(participations)
        .where(eq(participations.shiftId, toShiftId));
      const reservedCount = Number(countRow?.reservedCount ?? 0);
      if (reservedCount >= toShift.capacity) return "full";
    }

    // Conserva el mismo participation_id (spec §1.2B)
    await tx
      .update(participations)
      .set({ shiftId: toShiftId })
      .where(eq(participations.id, sourceParticipation.id));

    await tx.insert(participationEvents).values({
      participationId: sourceParticipation.id,
      personId,
      actorProfileId: personId,
      shiftId: toShiftId,
      fromShiftId,
      eventType: "changed",
      createdAt: now,
    });

    return "changed";
  });
}

export async function checkIn(
  shiftId: string,
  personId: string,
  organizerProfileId: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<CheckInResult> {
  if (!isUuid(shiftId) || !isUuid(personId) || !isUuid(organizerProfileId)) {
    return "missing";
  }

  const conn = await resolveDb(db);

  return conn.transaction(async (tx) => {
    const [profile] = await tx
      .select({ id: profiles.id, status: profiles.status })
      .from(profiles)
      .where(eq(profiles.id, personId))
      .limit(1);

    if (!profile) return "missing";
    if (profile.status !== "active") return "deactivated";

    const [participation] = await tx
      .select({
        id: participations.id,
        status: participations.status,
      })
      .from(participations)
      .where(
        and(
          eq(participations.personId, personId),
          eq(participations.shiftId, shiftId),
        ),
      )
      .for("update");

    if (!participation) return "missing";
    if (participation.status === "attended") return "already";

    await tx
      .update(participations)
      .set({
        status: "attended",
        attendedAt: now,
        validatedBy: organizerProfileId,
        attendanceMethod: "qr",
      })
      .where(eq(participations.id, participation.id));

    await tx.insert(participationEvents).values({
      participationId: participation.id,
      personId,
      actorProfileId: organizerProfileId,
      shiftId,
      eventType: "attendance_qr",
      createdAt: now,
    });

    return "recorded";
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
