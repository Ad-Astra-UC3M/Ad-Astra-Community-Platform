/**
 * @file Consultas Drizzle para las vistas del catálogo y Mis actividades. Las funciones de `portal.ts`
 * proporcionan el identificador de la persona conectada.
 */

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import type { AppDb, AppDbOrTx } from "../../db/client";
import {
  activities,
  activityImages,
  participations,
  shifts,
  type ParticipationStatus,
  type PublishStatus,
} from "../../db/schema";
import { isUuid } from "../profiles/identity";
import { computeAvailable, resolveDb } from "./shared";

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
  activityStatus: PublishStatus;
  location: string;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  agendaSection: "upcoming" | "ongoing" | "history";
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

/**
 * Carga en lote las galerías para `listActivities` y `getActivity`. La primera imagen por posición se
 * usa como portada.
 * @param conn Conexión o transacción usada para la consulta.
 * @param activityIds IDs de las actividades cuyas imágenes se agrupan.
 * @returns Un mapa de imágenes ordenadas por posición, agrupadas por actividad.
 */
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

/**
 * Agrupa los turnos para catálogo, detalle y posibles cambios de reserva.
 * @param conn Conexión o transacción usada para consultar turnos y participaciones.
 * @param activityIds IDs de las actividades solicitadas.
 * @param personId Perfil cuyo estado de reserva se incorpora a cada turno.
 * @returns Un mapa por actividad con turnos, ocupación, plazas libres y reserva propia.
 */
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

/**
 * Prepara el catálogo publicado que solicita `listMyVisibleActivities`, con turnos y galerías cargados
 * en paralelo.
 * @param personId Perfil usado para marcar la reserva propia en cada turno.
 * @param db Conexión opcional para pruebas.
 * @returns Las actividades publicadas por título, con portada, imágenes y turnos.
 */
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

/**
 * Prepara el detalle que solicita `getMyVisibleActivity`, con turnos y galería cargados en paralelo.
 * @param activityIdOrSlug ID o slug recibido de la ruta de la actividad.
 * @param personId Perfil usado para indicar sus reservas en los turnos.
 * @param db Conexión opcional para pruebas.
 * @returns Una actividad publicada completa o `undefined` si no se encuentra.
 */
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

/**
 * Sirve el acceso directo a turnos que el módulo `accounts/operations.ts` muestra en el panel a quien
 * puede validar asistencia.
 * @param db Conexión opcional para pruebas.
 * @returns Los turnos con los datos de sus actividades, ordenados por inicio e ID.
 */
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

/**
 * Prepara los datos que `listMyReservations` presenta en Mis actividades, incluidas las opciones de
 * cancelación y cambio.
 * @param personId UUID de la persona cuyas participaciones se consultan.
 * @param db Conexión opcional para pruebas.
 * @param now Instante que sitúa cada reserva en la agenda y determina sus opciones de cambio y cancelación.
 * @returns Las reservas ordenadas por inicio, el estado editorial para enlazar solo a actividades
 * publicadas y los posibles destinos libres y futuros en la misma actividad.
 */
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
    const agendaSection = canCancel
      ? "upcoming"
      : row.status === "booked" && row.endsAt.getTime() > nowMs
        ? "ongoing"
        : "history";
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
      activityStatus: row.activityStatus,
      location: row.locationOverride ?? row.activityLocation,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      agendaSection,
      canCancel,
      otherShifts,
    };
  });
}
