/**
 * Esquema Drizzle de talento voluntario y decisiones de difusión. Los módulos
 * de perfiles usan estas tablas para editar el perfil propio, consultar talento
 * con la capacidad correspondiente y conservar el historial de autorizaciones.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { profiles } from "./identity";

export const TALENT_EXPERIENCE_KINDS = ["team", "project", "work"] as const;
export type TalentExperienceKind = (typeof TALENT_EXPERIENCE_KINDS)[number];

export const TALENT_LINK_KINDS = [
  "cv",
  "linkedin",
  "github",
  "portfolio",
  "other",
] as const;
export type TalentLinkKind = (typeof TALENT_LINK_KINDS)[number];

export interface TalentExperience {
  kind: TalentExperienceKind;
  title: string;
  organization?: string | null;
  description?: string | null;
  is_featured: boolean;
  sort_order: number;
}

export interface TalentLanguage {
  language: string;
  level: string;
}

export interface TalentLink {
  kind: TalentLinkKind;
  label: string;
  url: string;
}

/**
 * Un perfil de talento por persona. Los índices GIN respaldan el filtro por
 * etiquetas de los campos de tipo array. Los CHECK delegan la validación de
 * experiencias, idiomas y enlaces JSONB en funciones definidas en el SQL inicial.
 */
export const talentProfiles = pgTable(
  "talent_profiles",
  {
    personId: uuid("person_id")
      .primaryKey()
      .references(() => profiles.id),
    university: varchar("university", { length: 160 }),
    expectedGraduationYear: smallint("expected_graduation_year"),
    headline: varchar("headline", { length: 200 }),
    skills: text("skills")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    tools: text("tools")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    interests: text("interests")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    sectors: text("sectors")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    opportunityTypes: text("opportunity_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    experiences: jsonb("experiences")
      .$type<TalentExperience[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    languages: jsonb("languages")
      .$type<TalentLanguage[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    links: jsonb("links")
      .$type<TalentLink[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("talent_profiles_skills_gin_idx").using("gin", table.skills),
    index("talent_profiles_tools_gin_idx").using("gin", table.tools),
    index("talent_profiles_interests_gin_idx").using("gin", table.interests),
    index("talent_profiles_sectors_gin_idx").using("gin", table.sectors),
    index("talent_profiles_opportunity_types_gin_idx").using(
      "gin",
      table.opportunityTypes,
    ),
    check(
      "talent_profiles_graduation_year_check",
      sql`${table.expectedGraduationYear} IS NULL OR (${table.expectedGraduationYear} >= 1950 AND ${table.expectedGraduationYear} <= 2100)`,
    ),
    check(
      "talent_profiles_experiences_check",
      sql`public.is_valid_talent_experiences(${table.experiences})`,
    ),
    check(
      "talent_profiles_languages_check",
      sql`public.is_valid_talent_languages(${table.languages})`,
    ),
    check(
      "talent_profiles_links_check",
      sql`public.is_valid_talent_links(${table.links})`,
    ),
  ],
);

/**
 * Historial de concesiones y retiradas de difusión por persona y finalidad.
 * Cada fila registra la decisión, su origen, la versión de política y su posible
 * caducidad. El índice facilita consultar las decisiones de una finalidad.
 */
export const talentDisseminationDecisions = pgTable(
  "talent_dissemination_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personId: uuid("person_id")
      .notNull()
      .references(() => profiles.id),
    purpose: varchar("purpose", { length: 80 }).notNull(),
    granted: boolean("granted").notNull(),
    policyVersion: varchar("policy_version", { length: 40 }).notNull(),
    source: varchar("source", { length: 40 }).notNull().default("portal"),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("talent_dissemination_decisions_person_purpose_idx").on(
      table.personId,
      table.purpose,
      table.decidedAt,
      table.id,
    ),
  ],
);

export type TalentProfileRow = typeof talentProfiles.$inferSelect;
export type TalentDisseminationDecisionRow =
  typeof talentDisseminationDecisions.$inferSelect;
