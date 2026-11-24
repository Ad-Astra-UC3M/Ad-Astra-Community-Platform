/**
 * Esquema Drizzle de identidad local, capacidades, auditoría y supresión. El
 * servicio de Auth enlaza el identificador de Neon Auth con profiles. Los
 * módulos de cuentas y perfiles operan sobre estas tablas desde el servidor.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const CAPABILITY_CODES = [
  "general_admin",
  "content_editing",
  "attendance_validation",
  "talent_consultation",
] as const;
export type CapabilityCode = (typeof CAPABILITY_CODES)[number];

export const ACCOUNT_STATUSES = ["active", "deactivated"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const DELETION_STATUSES = ["pending", "in_review", "resolved"] as const;
export type DeletionStatus = (typeof DELETION_STATUSES)[number];

export const capabilityCodeEnum = pgEnum("capability_code", CAPABILITY_CODES);
export const accountStatusEnum = pgEnum("account_status", ACCOUNT_STATUSES);
export const deletionStatusEnum = pgEnum("deletion_status", DELETION_STATUSES);

/**
 * Perfil de Comunidad, enlazable con Neon Auth mediante authUserId único.
 * PostgreSQL exige correo UC3M normalizado, aceptación de privacidad y versión QR
 * positiva. Los módulos de Auth y perfil usan los datos y las fechas de esta fila.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: text("auth_user_id").unique(),
    email: text("email").notNull().unique(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    degree: varchar("degree", { length: 120 }).notNull(),
    academicLevel: varchar("academic_level", { length: 40 }),
    languageModality: varchar("language_modality", { length: 40 }),
    course: varchar("course", { length: 40 }).notNull(),
    privacyAccepted: boolean("privacy_accepted").notNull(),
    privacyVersion: varchar("privacy_version", { length: 40 }).notNull(),
    privacyAcceptedAt: timestamp("privacy_accepted_at", {
      withTimezone: true,
    }).notNull(),
    status: accountStatusEnum("status").notNull().default("active"),
    qrVersion: integer("qr_version").notNull().default(1),
    registeredAt: timestamp("registered_at", { withTimezone: true }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    avatarKey: text("avatar_key"),
    avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "profiles_email_normalized_check",
      sql`${table.email} = lower(btrim(${table.email}))`,
    ),
    check(
      "profiles_email_uc3m_check",
      sql`${table.email} ~ '^[a-z0-9!#$%&''*+/=?^_\`{|}~-]+(\\.[a-z0-9!#$%&''*+/=?^_\`{|}~-]+)*@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)*uc3m\\.es$'`,
    ),
    check(
      "profiles_privacy_accepted_check",
      sql`${table.privacyAccepted} = true`,
    ),
    check("profiles_qr_version_check", sql`${table.qrVersion} >= 1`),
    check(
      "profiles_avatar_key_check",
      sql`${table.avatarKey} IS NULL OR ${table.avatarKey} ~ '^avatars/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp|avif)$'`,
    ),
    check(
      "profiles_avatar_consistency_check",
      sql`(${table.avatarKey} IS NULL AND ${table.avatarUpdatedAt} IS NULL) OR (${table.avatarKey} IS NOT NULL AND ${table.avatarUpdatedAt} IS NOT NULL)`,
    ),
  ],
);

/**
 * Capacidades independientes de un perfil. La clave compuesta evita duplicados.
 * La aplicación las consulta al autorizar operaciones y el bootstrap puede
 * conceder general_admin sin un concedente registrado.
 */
export const accountCapabilities = pgTable(
  "account_capabilities",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id),
    capabilityCode: capabilityCodeEnum("capability_code").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    grantedBy: uuid("granted_by").references(() => profiles.id),
  },
  (table) => [
    primaryKey({
      name: "account_capabilities_pkey",
      columns: [table.profileId, table.capabilityCode],
    }),
  ],
);

/**
 * Auditoría administrativa consultable por tipo de destino, identificador y fecha.
 * Valida el objeto de metadatos y las entradas de concesión y revocación. El actor
 * solo puede faltar en entradas identificadas como bootstrap.
 */
export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorProfileId: uuid("actor_profile_id").references(() => profiles.id),
    targetType: varchar("target_type", { length: 40 }).notNull(),
    targetId: uuid("target_id").notNull(),
    action: varchar("action", { length: 60 }).notNull(),
    result: varchar("result", { length: 20 }).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("admin_audit_logs_target_created_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    check(
      "admin_audit_logs_metadata_object_check",
      sql`jsonb_typeof(${table.metadata}) = 'object'`,
    ),
    check(
      "admin_audit_logs_actor_check",
      sql`${table.actorProfileId} IS NOT NULL OR COALESCE(${table.metadata}->>'source', '') = 'bootstrap'`,
    ),
    check(
      "admin_audit_logs_capability_action_check",
      sql`${table.action} NOT IN ('capability_granted', 'capability_revoked') OR (${table.targetType} = 'profile' AND COALESCE(${table.metadata}->>'capability', '') IN ('general_admin', 'content_editing', 'attendance_validation', 'talent_consultation'))`,
    ),
  ],
);

/**
 * Solicitudes de supresión de cuenta. El índice parcial limita cada persona a
 * una solicitud pendiente o en revisión. Resolver exige nota, autor y fecha.
 */
export const deletionRequests = pgTable(
  "deletion_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personId: uuid("person_id")
      .notNull()
      .references(() => profiles.id),
    status: deletionStatusEnum("status").notNull().default("pending"),
    reason: text("reason"),
    resolutionNote: text("resolution_note"),
    resolvedBy: uuid("resolved_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("deletion_requests_open_person_idx")
      .on(table.personId)
      .where(sql`${table.status} IN ('pending', 'in_review')`),
    check(
      "deletion_requests_resolution_check",
      sql`(${table.status} <> 'resolved' AND ${table.resolutionNote} IS NULL AND ${table.resolvedBy} IS NULL AND ${table.resolvedAt} IS NULL) OR (${table.status} = 'resolved' AND ${table.resolvedBy} IS NOT NULL AND ${table.resolvedAt} IS NOT NULL AND ${table.resolutionNote} IS NOT NULL AND length(btrim(${table.resolutionNote})) > 0)`,
    ),
  ],
);

export type ProfileRow = typeof profiles.$inferSelect;
export type NewProfileRow = typeof profiles.$inferInsert;
export type AccountCapabilityRow = typeof accountCapabilities.$inferSelect;
export type AdminAuditLogRow = typeof adminAuditLogs.$inferSelect;
export type DeletionRequestRow = typeof deletionRequests.$inferSelect;

/**
 * Objetos retirados pendientes de borrado físico. Se registra la clave en la misma transacción
 * que cambia el perfil para conservar los reintentos si Neon Storage falla. Sin FK: la limpieza
 * debe poder terminar incluso si el perfil se elimina después.
 */
export const avatarDeletions = pgTable("avatar_deletions", {
  key: text("key").primaryKey(),
  personId: uuid("person_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("avatar_deletions_person_id_idx").on(table.personId)]);
