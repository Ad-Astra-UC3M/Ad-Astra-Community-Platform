/**
 * Esquema Drizzle de publicación de actividades, imágenes, turnos, reservas y
 * asistencia. Las operaciones de src/server/activities aplican las reglas de
 * negocio sobre estas tablas PostgreSQL. El estado editorial se comparte con el
 * catálogo de oportunidades.
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { profiles } from "./identity";

export const PUBLISH_STATUSES = ["draft", "published", "archived"] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

export const PARTICIPATION_STATUSES = ["booked", "attended"] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

export const ATTENDANCE_METHODS = ["qr", "manual"] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[number];

export const PARTICIPATION_EVENT_TYPES = [
  "reserved",
  "changed",
  "cancelled",
  "door_registered",
  "attendance_qr",
  "attendance_manual",
  "attendance_corrected",
] as const;
export type ParticipationEventType = (typeof PARTICIPATION_EVENT_TYPES)[number];

export const publishStatusEnum = pgEnum("publish_status", PUBLISH_STATUSES);
export const participationStatusEnum = pgEnum(
  "participation_status",
  PARTICIPATION_STATUSES,
);
export const attendanceMethodEnum = pgEnum(
  "attendance_method",
  ATTENDANCE_METHODS,
);

/**
 * Ficha y estado de publicación de una actividad identificada por slug. Si hay
 * un enlace de inscripción externa, PostgreSQL exige que empiece por HTTPS.
 */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    location: varchar("location", { length: 200 }).notNull(),
    externalRegistrationUrl: text("external_registration_url"),
    status: publishStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by").references(() => profiles.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "activities_external_registration_url_https_check",
      sql`${table.externalRegistrationUrl} IS NULL OR ${table.externalRegistrationUrl} ~ '^https://'`,
    ),
  ],
);

/**
 * Galería de una actividad. Cada posición positiva es única dentro de la
 * galería. Exige URL HTTPS y texto alternativo y se borra junto con la actividad.
 */
export const activityImages = pgTable(
  "activity_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    imageAlt: varchar("image_alt", { length: 240 }).notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("activity_images_activity_position_unique").on(
      table.activityId,
      table.position,
    ),
    check(
      "activity_images_url_https_check",
      sql`${table.imageUrl} ~ '^https://'`,
    ),
    check(
      "activity_images_alt_nonempty_check",
      sql`length(btrim(${table.imageAlt})) > 0`,
    ),
    check("activity_images_position_check", sql`${table.position} >= 1`),
  ],
);

/**
 * Horario y aforo de una convocatoria de la actividad. La base comprueba el
 * orden de las fechas y la capacidad positiva. Un aforo nulo indica que no se
 * ha fijado un límite.
 */
export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id),
    name: varchar("name", { length: 100 }).notNull().default("normal"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    capacity: integer("capacity"),
    locationOverride: varchar("location_override", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("shifts_activity_starts_idx").on(table.activityId, table.startsAt),
    check("shifts_time_range_check", sql`${table.endsAt} > ${table.startsAt}`),
    check(
      "shifts_capacity_check",
      sql`${table.capacity} IS NULL OR ${table.capacity} > 0`,
    ),
  ],
);

/**
 * Reserva de una persona en un turno, con su estado y datos de asistencia.
 * La clave única persona–turno impide duplicados en ese turno. El servicio de
 * participación comprueba el aforo del turno antes de adjudicar la plaza.
 */
export const participations = pgTable(
  "participations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personId: uuid("person_id")
      .notNull()
      .references(() => profiles.id),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id),
    status: participationStatusEnum("status").notNull().default("booked"),
    reservedAt: timestamp("reserved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    attendedAt: timestamp("attended_at", { withTimezone: true }),
    validatedBy: uuid("validated_by").references(() => profiles.id),
    attendanceMethod: attendanceMethodEnum("attendance_method"),
    source: varchar("source", { length: 40 }).notNull().default("portal"),
    externalRef: varchar("external_ref", { length: 120 }),
  },
  (table) => [
    unique("participations_person_shift_unique").on(
      table.personId,
      table.shiftId,
    ),
    index("participations_shift_idx").on(table.shiftId),
    index("participations_person_idx").on(table.personId),
    check(
      "participations_status_fields_check",
      sql`(${table.status} = 'booked' AND ${table.attendedAt} IS NULL AND ${table.validatedBy} IS NULL AND ${table.attendanceMethod} IS NULL) OR (${table.status} = 'attended' AND ${table.attendedAt} IS NOT NULL)`,
    ),
  ],
);

/**
 * Historial de reservas, cambios, cancelaciones y asistencia. El identificador
 * de participación se conserva como dato histórico aunque se borre la reserva.
 * Los CHECK exigen turno de origen para cambios, transición para rectificaciones
 * y motivo para altas en puerta, confirmaciones manuales y rectificaciones.
 */
export const participationEvents = pgTable(
  "participation_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    participationId: uuid("participation_id").notNull(),
    personId: uuid("person_id")
      .notNull()
      .references(() => profiles.id),
    actorProfileId: uuid("actor_profile_id")
      .notNull()
      .references(() => profiles.id),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id),
    fromShiftId: uuid("from_shift_id").references(() => shifts.id),
    eventType: varchar("event_type", { length: 24 })
      .$type<ParticipationEventType>()
      .notNull(),
    previousStatus: participationStatusEnum("previous_status"),
    newStatus: participationStatusEnum("new_status"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("participation_events_chronology_idx").on(
      table.participationId,
      table.createdAt,
      table.id,
    ),
    check(
      "participation_events_event_type_check",
      sql`${table.eventType} IN ('reserved', 'changed', 'cancelled', 'door_registered', 'attendance_qr', 'attendance_manual', 'attendance_corrected')`,
    ),
    check(
      "participation_events_from_shift_check",
      sql`(${table.eventType} = 'changed' AND ${table.fromShiftId} IS NOT NULL AND ${table.fromShiftId} <> ${table.shiftId}) OR (${table.eventType} <> 'changed' AND ${table.fromShiftId} IS NULL)`,
    ),
    check(
      "participation_events_status_transition_check",
      sql`(${table.eventType} = 'attendance_corrected' AND ${table.previousStatus} IS NOT NULL AND ${table.newStatus} IS NOT NULL AND ${table.previousStatus} <> ${table.newStatus}) OR (${table.eventType} <> 'attendance_corrected' AND ${table.previousStatus} IS NULL AND ${table.newStatus} IS NULL)`,
    ),
    check(
      "participation_events_reason_check",
      sql`${table.eventType} NOT IN ('door_registered', 'attendance_manual', 'attendance_corrected') OR (${table.reason} IS NOT NULL AND length(btrim(${table.reason})) > 0)`,
    ),
  ],
);

export type ActivityRow = typeof activities.$inferSelect;
export type ActivityImageRow = typeof activityImages.$inferSelect;
export type ShiftRow = typeof shifts.$inferSelect;
export type ParticipationRow = typeof participations.$inferSelect;
export type ParticipationEventRow = typeof participationEvents.$inferSelect;
