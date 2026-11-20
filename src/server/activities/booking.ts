/**
 * @file Adjudicación de plazas compartida por el portal y el alta en puerta. Las comprobaciones de
 * ocupación se ejecutan con el turno bloqueado.
 */

import { and, eq, sql } from "drizzle-orm";

import type { AppDb, AppTransaction } from "../../db/client";
import { activities, participationEvents, participations, profiles, shifts } from "../../db/schema";
import { profileExists } from "../profiles/identity";
import { resolveDb } from "./shared";

type AllocationInput = { shiftId: string; personId: string } & (
  | { source: "portal"; activityKey: string }
  | { source: "door"; actorProfileId: string; reason: string }
);

type AllocationError =
  | "missing_shift"
  | "missing_account"
  | "account_deactivated"
  | "missing_actor"
  | "activity_mismatch"
  | "activity_not_published"
  | "shift_started"
  | "shift_ended"
  | "duplicate"
  | "full";

type AllocationResult =
  | { ok: true; participationId: string; firstName: string; lastName: string }
  | { ok: false; error: AllocationError };

/**
 * Comprueba duplicados y aforo para `allocateShiftPlace` y `changeReservation`.
 * @param tx Transacción en la que el llamador ya bloqueó el turno de destino.
 * @param shiftId Turno cuya ocupación se cuenta.
 * @param personId Persona que solicita la plaza, usada para detectar una reserva duplicada.
 * @param capacity Aforo del turno bloqueado. `null` permite plazas ilimitadas.
 * @returns `duplicate`, `full` o `available`, en ese orden de comprobación.
 */
export async function checkSeatAvailability(
  tx: AppTransaction,
  shiftId: string,
  personId: string,
  capacity: number | null,
): Promise<"duplicate" | "full" | "available"> {
  const [existing] = await tx
    .select({ id: participations.id })
    .from(participations)
    .where(and(eq(participations.shiftId, shiftId), eq(participations.personId, personId)))
    .limit(1);
  if (existing) return "duplicate";
  if (capacity === null) return "available";

  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(participations)
    .where(eq(participations.shiftId, shiftId));
  return count >= capacity ? "full" : "available";
}

/**
 * Adjudica plazas para `reserveShift` y `registerAtDoor`. Bloquea el turno con `FOR UPDATE` y guarda la
 * participación `booked` y su evento en la misma transacción.
 * @param input Persona, turno y origen. Portal comprueba la actividad indicada. Puerta exige cuenta
 * verificada y guarda actor y motivo.
 * @param now Instante de la reserva y del evento. Portal comprueba el inicio y puerta comprueba el fin
 * del turno.
 * @param db Conexión opcional para pruebas.
 * @returns El ID de participación y el nombre de la persona, o el error concreto de adjudicación.
 */
export async function allocateShiftPlace(
  input: AllocationInput,
  now: Date,
  db?: AppDb,
): Promise<AllocationResult> {
  const database = await resolveDb(db);
  const { shiftId, personId, source } = input;

  return database.transaction(async (tx) => {
    // All seat writers lock the shift before inspecting or changing occupancy.
    const [shift] = await tx
      .select({
        id: shifts.id,
        activityId: shifts.activityId,
        startsAt: shifts.startsAt,
        endsAt: shifts.endsAt,
        capacity: shifts.capacity,
      })
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .for("update");
    if (!shift) return { ok: false, error: "missing_shift" };

    const [activity] = await tx
      .select({ id: activities.id, slug: activities.slug, status: activities.status })
      .from(activities)
      .where(eq(activities.id, shift.activityId))
      .limit(1);

    if (source === "portal" && (!activity || (
      activity.id !== input.activityKey && activity.slug !== input.activityKey
    ))) {
      return { ok: false, error: "activity_mismatch" };
    }

    const [person] = await tx
      .select({
        status: profiles.status,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        emailVerifiedAt: profiles.emailVerifiedAt,
      })
      .from(profiles)
      .where(eq(profiles.id, personId))
      .limit(1);

    if (!person || (source === "door" && !person.emailVerifiedAt)) {
      return { ok: false, error: "missing_account" };
    }
    if (person.status !== "active") return { ok: false, error: "account_deactivated" };
    if (source === "door" && !(await profileExists(tx, input.actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }
    if (activity?.status !== "published") return { ok: false, error: "activity_not_published" };

    if (source === "portal" && shift.startsAt <= now) return { ok: false, error: "shift_started" };
    if (source === "door" && shift.endsAt <= now) return { ok: false, error: "shift_ended" };

    const availability = await checkSeatAvailability(tx, shiftId, personId, shift.capacity);
    if (availability !== "available") return { ok: false, error: availability };

    const [participation] = await tx
      .insert(participations)
      .values({ personId, shiftId, status: "booked", reservedAt: now, source })
      .returning({ id: participations.id });

    await tx.insert(participationEvents).values({
      participationId: participation.id,
      personId,
      actorProfileId: source === "portal" ? personId : input.actorProfileId,
      shiftId,
      eventType: source === "portal" ? "reserved" : "door_registered",
      reason: source === "portal" ? null : input.reason,
      createdAt: now,
    });

    return { ok: true, participationId: participation.id, firstName: person.firstName, lastName: person.lastName };
  });
}
