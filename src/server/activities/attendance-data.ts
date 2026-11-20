import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import type { AppDb } from "../../db/client";
import {
  PARTICIPATION_STATUSES,
  activities,
  participationEvents,
  participations,
  profiles,
  shifts,
  type AttendanceMethod,
  type ParticipationEventType,
  type ParticipationStatus,
  type PublishStatus,
} from "../../db/schema";
import { allocateShiftPlace } from "./booking";
import { formatName, isUuid, profileExists } from "../profiles/identity";
import { computeAvailable, resolveDb } from "./shared";

const participationStatusSchema = z.enum(PARTICIPATION_STATUSES);

const AUDIT_EVENT_TYPES: readonly ParticipationEventType[] = [
  "door_registered",
  "attendance_qr",
  "attendance_manual",
  "attendance_corrected",
  "cancelled",
  "changed",
];

const reasonSchema = z.string().trim().min(1).max(500);

export interface ShiftDetail {
  id: string;
  name: string;
  activityId: string;
  activitySlug: string;
  activityTitle: string;
  activityStatus: PublishStatus;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  locationOverride: string | null;
  reservedCount: number;
  attendedCount: number;
  available: number | null;
}

export interface ShiftAttendeeDetail {
  participationId: string;
  personId: string;
  name: string;
  email: string;
  status: ParticipationStatus;
  reservedAt: Date;
  attendedAt: Date | null;
  attendanceMethod: AttendanceMethod | null;
  source: string;
}

export interface DoorAccountCandidate {
  id: string;
  name: string;
  email: string;
  degree: string;
  course: string;
  alreadyInShift: boolean;
}

export type DoorRegistrationResult =
  | {
      ok: true;
      participationId: string;
      status: "booked";
      personId: string;
      personName: string;
      shiftId: string;
    }
  | { ok: false; error: "duplicate"; existing: true }
  | {
      ok: false;
      error:
        | "missing_reason"
        | "missing_actor"
        | "missing_account"
        | "account_deactivated"
        | "missing_shift"
        | "activity_not_published"
        | "shift_ended"
        | "full";
    };

export type AttendanceAdjustmentResult =
  | {
      ok: true;
      participationId: string;
      previousStatus: ParticipationStatus;
      newStatus: ParticipationStatus;
    }
  | {
      ok: false;
      error:
        | "missing_reason"
        | "missing_actor"
        | "invalid_status"
        | "missing_reservation"
        | "account_deactivated"
        | "already_attended"
        | "unchanged";
    };

export interface AttendanceAuditEntry {
  id: string;
  participationId: string;
  shiftId: string;
  fromShiftId: string | null;
  personId: string;
  personName: string;
  eventType: ParticipationEventType;
  previousStatus: ParticipationStatus | null;
  newStatus: ParticipationStatus | null;
  reason: string | null;
  actorProfileId: string;
  actorName: string;
  createdAt: Date;
}

async function queryShiftSummaries(db: AppDb, shiftId?: string): Promise<ShiftDetail[]> {
  const rows = await db
    .select({
      id: shifts.id,
      name: shifts.name,
      activityId: shifts.activityId,
      activitySlug: activities.slug,
      activityTitle: activities.title,
      activityStatus: activities.status,
      startsAt: shifts.startsAt,
      endsAt: shifts.endsAt,
      capacity: shifts.capacity,
      locationOverride: shifts.locationOverride,
      reservedCount: sql<number>`COUNT(${participations.id})::int`,
      attendedCount: sql<number>`COUNT(${participations.id}) FILTER (WHERE ${participations.status} = 'attended')::int`,
    })
    .from(shifts)
    .innerJoin(activities, eq(activities.id, shifts.activityId))
    .leftJoin(participations, eq(participations.shiftId, shifts.id))
    .where(shiftId ? eq(shifts.id, shiftId) : undefined)
    .groupBy(shifts.id, activities.id)
    .orderBy(asc(shifts.startsAt), asc(shifts.id));

  return rows.map((row) => ({
    ...row,
    available: computeAvailable(row.capacity, row.reservedCount),
  }));
}

export async function listShiftSummaries(db?: AppDb): Promise<ShiftDetail[]> {
  return queryShiftSummaries(await resolveDb(db));
}

export async function getShiftDetail(
  shiftId: string,
  db?: AppDb,
): Promise<ShiftDetail | null> {
  if (!isUuid(shiftId)) return null;
  const [shift] = await queryShiftSummaries(await resolveDb(db), shiftId);
  return shift ?? null;
}

export async function listShiftAttendeesDetailed(
  shiftId: string,
  query = "",
  db?: AppDb,
): Promise<ShiftAttendeeDetail[]> {
  if (!isUuid(shiftId)) return [];
  const database = await resolveDb(db);

  const rows = await database
    .select({
      participationId: participations.id,
      personId: participations.personId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      status: participations.status,
      reservedAt: participations.reservedAt,
      attendedAt: participations.attendedAt,
      attendanceMethod: participations.attendanceMethod,
      source: participations.source,
    })
    .from(participations)
    .innerJoin(profiles, eq(profiles.id, participations.personId))
    .where(eq(participations.shiftId, shiftId))
    .orderBy(asc(profiles.firstName), asc(profiles.lastName), asc(profiles.id));

  const needle = query.trim().toLowerCase();
  return rows
    .map((row): ShiftAttendeeDetail => ({
      participationId: row.participationId,
      personId: row.personId,
      name: formatName(row.firstName, row.lastName),
      email: row.email,
      status: row.status,
      reservedAt: row.reservedAt,
      attendedAt: row.attendedAt ?? null,
      attendanceMethod: row.attendanceMethod ?? null,
      source: row.source,
    }))
    .filter((entry) => {
      if (!needle) return true;
      return (
        entry.name.toLowerCase().includes(needle) ||
        entry.email.toLowerCase().includes(needle) ||
        entry.personId.toLowerCase().includes(needle)
      );
    });
}

export async function listActiveAccountsForDoor(
  shiftId: string,
  query = "",
  db?: AppDb,
): Promise<DoorAccountCandidate[]> {
  if (!isUuid(shiftId)) return [];
  const database = await resolveDb(db);

  const rows = await database
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      degree: profiles.degree,
      course: profiles.course,
      participationId: participations.id,
    })
    .from(profiles)
    .leftJoin(
      participations,
      and(
        eq(participations.personId, profiles.id),
        eq(participations.shiftId, shiftId),
      ),
    )
    .where(
      and(
        eq(profiles.status, "active"),
        sql`${profiles.emailVerifiedAt} IS NOT NULL`,
      ),
    )
    .orderBy(asc(profiles.firstName), asc(profiles.lastName), asc(profiles.id));

  const needle = query.trim().toLowerCase();
  return rows
    .map((row): DoorAccountCandidate => ({
      id: row.id,
      name: formatName(row.firstName, row.lastName),
      email: row.email,
      degree: row.degree,
      course: row.course,
      alreadyInShift: row.participationId !== null,
    }))
    .filter((entry) => {
      if (!needle) return true;
      return (
        entry.name.toLowerCase().includes(needle) ||
        entry.email.toLowerCase().includes(needle) ||
        entry.degree.toLowerCase().includes(needle)
      );
    });
}

export async function registerAtDoor(
  shiftId: string,
  targetPersonId: string,
  actorProfileId: string,
  reason: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<DoorRegistrationResult> {
  const parsedReason = reasonSchema.safeParse(reason);
  if (!parsedReason.success) return { ok: false, error: "missing_reason" };
  if (!isUuid(shiftId)) return { ok: false, error: "missing_shift" };
  if (!isUuid(targetPersonId)) return { ok: false, error: "missing_account" };
  if (!isUuid(actorProfileId)) return { ok: false, error: "missing_actor" };

  const result = await allocateShiftPlace({
    source: "door",
    shiftId,
    personId: targetPersonId,
    actorProfileId,
    reason: parsedReason.data,
  }, now, db);

  if (result.ok) {
    return {
      ok: true,
      participationId: result.participationId,
      status: "booked",
      personId: targetPersonId,
      personName: formatName(result.firstName, result.lastName),
      shiftId,
    };
  }

  switch (result.error) {
    case "duplicate":
      return { ok: false, error: "duplicate", existing: true };
    case "activity_mismatch":
    case "shift_started":
      return { ok: false, error: "missing_shift" };
    default:
      return { ok: false, error: result.error };
  }
}

export async function manualConfirmAttendance(
  shiftId: string,
  personId: string,
  actorProfileId: string,
  reason: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<AttendanceAdjustmentResult> {
  const parsedReason = reasonSchema.safeParse(reason);
  if (!parsedReason.success) {
    return { ok: false, error: "missing_reason" };
  }
  if (!isUuid(shiftId) || !isUuid(personId)) {
    return { ok: false, error: "missing_reservation" };
  }
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }

  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [participation] = await tx
      .select()
      .from(participations)
      .where(
        and(
          eq(participations.shiftId, shiftId),
          eq(participations.personId, personId),
        ),
      )
      .for("update");

    if (!participation) {
      return { ok: false, error: "missing_reservation" };
    }

    const [target] = await tx
      .select({ status: profiles.status })
      .from(profiles)
      .where(eq(profiles.id, personId))
      .limit(1);

    if (!target || target.status !== "active") {
      return { ok: false, error: "account_deactivated" };
    }

    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    if (participation.status === "attended") {
      return { ok: false, error: "already_attended" };
    }

    await tx
      .update(participations)
      .set({
        status: "attended",
        attendedAt: now,
        validatedBy: actorProfileId,
        attendanceMethod: "manual",
      })
      .where(eq(participations.id, participation.id));

    await tx.insert(participationEvents).values({
      participationId: participation.id,
      personId,
      actorProfileId,
      shiftId,
      eventType: "attendance_manual",
      reason: parsedReason.data,
      createdAt: now,
    });

    return {
      ok: true,
      participationId: participation.id,
      previousStatus: "booked",
      newStatus: "attended",
    };
  });
}

export async function correctAttendance(
  shiftId: string,
  personId: string,
  targetStatus: ParticipationStatus,
  actorProfileId: string,
  reason: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<AttendanceAdjustmentResult> {
  const parsedStatus = participationStatusSchema.safeParse(targetStatus);
  if (!parsedStatus.success) {
    return { ok: false, error: "invalid_status" };
  }
  const parsedReason = reasonSchema.safeParse(reason);
  if (!parsedReason.success) {
    return { ok: false, error: "missing_reason" };
  }
  if (!isUuid(shiftId) || !isUuid(personId)) {
    return { ok: false, error: "missing_reservation" };
  }
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }

  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [participation] = await tx
      .select()
      .from(participations)
      .where(
        and(
          eq(participations.shiftId, shiftId),
          eq(participations.personId, personId),
        ),
      )
      .for("update");

    if (!participation) {
      return { ok: false, error: "missing_reservation" };
    }

    if (parsedStatus.data === "attended") {
      const [target] = await tx
        .select({ status: profiles.status })
        .from(profiles)
        .where(eq(profiles.id, personId))
        .limit(1);
      if (!target || target.status !== "active") {
        return { ok: false, error: "account_deactivated" };
      }
    }

    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    const previousStatus = participation.status;
    if (previousStatus === parsedStatus.data) {
      return { ok: false, error: "unchanged" };
    }

    if (parsedStatus.data === "attended") {
      await tx
        .update(participations)
        .set({
          status: "attended",
          attendedAt: now,
          validatedBy: actorProfileId,
          attendanceMethod: "manual",
        })
        .where(eq(participations.id, participation.id));
    } else {
      await tx
        .update(participations)
        .set({
          status: "booked",
          attendedAt: null,
          validatedBy: null,
          attendanceMethod: null,
        })
        .where(eq(participations.id, participation.id));
    }

    await tx.insert(participationEvents).values({
      participationId: participation.id,
      personId,
      actorProfileId,
      shiftId,
      eventType: "attendance_corrected",
      previousStatus,
      newStatus: parsedStatus.data,
      reason: parsedReason.data,
      createdAt: now,
    });

    return {
      ok: true,
      participationId: participation.id,
      previousStatus,
      newStatus: parsedStatus.data,
    };
  });
}

export async function listAttendanceAudit(
  shiftId: string,
  db?: AppDb,
): Promise<AttendanceAuditEntry[]> {
  if (!isUuid(shiftId)) return [];
  const database = await resolveDb(db);
  const personProfile = alias(profiles, "person_profile");
  const actorProfile = alias(profiles, "actor_profile");

  const rows = await database
    .select({
      id: participationEvents.id,
      participationId: participationEvents.participationId,
      shiftId: participationEvents.shiftId,
      fromShiftId: participationEvents.fromShiftId,
      personId: participationEvents.personId,
      personFirstName: personProfile.firstName,
      personLastName: personProfile.lastName,
      eventType: participationEvents.eventType,
      previousStatus: participationEvents.previousStatus,
      newStatus: participationEvents.newStatus,
      reason: participationEvents.reason,
      actorProfileId: participationEvents.actorProfileId,
      actorFirstName: actorProfile.firstName,
      actorLastName: actorProfile.lastName,
      createdAt: participationEvents.createdAt,
    })
    .from(participationEvents)
    .innerJoin(
      personProfile,
      eq(personProfile.id, participationEvents.personId),
    )
    .innerJoin(
      actorProfile,
      eq(actorProfile.id, participationEvents.actorProfileId),
    )
    .where(
      and(
        eq(participationEvents.shiftId, shiftId),
        inArray(participationEvents.eventType, [...AUDIT_EVENT_TYPES]),
      ),
    )
    .orderBy(
      asc(participationEvents.createdAt),
      asc(participationEvents.id),
    );

  return rows.map((row) => ({
    id: row.id,
    participationId: row.participationId,
    shiftId: row.shiftId,
    fromShiftId: row.fromShiftId ?? null,
    personId: row.personId,
    personName: formatName(row.personFirstName, row.personLastName),
    eventType: row.eventType,
    previousStatus: row.previousStatus ?? null,
    newStatus: row.newStatus ?? null,
    reason: row.reason ?? null,
    actorProfileId: row.actorProfileId,
    actorName: formatName(row.actorFirstName, row.actorLastName),
    createdAt: row.createdAt,
  }));
}
