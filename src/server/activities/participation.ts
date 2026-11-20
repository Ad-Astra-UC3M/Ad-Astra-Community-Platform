import { and, asc, eq, inArray } from "drizzle-orm";

import type { AppDb } from "../../db/client";
import { activities, participationEvents, participations, profiles, shifts } from "../../db/schema";
import { allocateShiftPlace, checkSeatAvailability } from "./booking";
import { isUuid } from "../profiles/identity";
import { resolveDb } from "./shared";

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

export async function reserveShift(
  activityIdOrSlug: string,
  shiftId: string,
  personId: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<ReserveShiftResult> {
  const activityKey = activityIdOrSlug.trim();
  if (!activityKey || !isUuid(shiftId) || !isUuid(personId)) return "missing";

  const result = await allocateShiftPlace({ source: "portal", activityKey, shiftId, personId }, now, db);
  if (result.ok) return "reserved";

  switch (result.error) {
    case "activity_not_published":
    case "shift_started":
      return "closed";
    case "account_deactivated":
      return "deactivated";
    case "duplicate":
    case "full":
      return result.error;
    default:
      return "missing";
  }
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

    const availability = await checkSeatAvailability(tx, toShiftId, personId, toShift.capacity);
    if (availability !== "available") return availability;

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
