import { sql } from "drizzle-orm";
import {
  check,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { publishStatusEnum } from "./activities";
import { profiles } from "./identity";

export const OPPORTUNITY_TYPES = ["internship", "research"] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const opportunityTypeEnum = pgEnum("opportunity_type", OPPORTUNITY_TYPES);

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    type: opportunityTypeEnum("type").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    organization: varchar("organization", { length: 160 }).notNull(),
    description: text("description").notNull(),
    requirements: text("requirements"),
    location: varchar("location", { length: 160 }),
    workModality: varchar("work_modality", { length: 40 }),
    researchLead: varchar("research_lead", { length: 160 }),
    applicationUrl: text("application_url"),
    contactEmail: varchar("contact_email", { length: 254 }),
    infoUrl: text("info_url"),
    imageUrl: text("image_url"),
    imageAlt: varchar("image_alt", { length: 240 }),
    status: publishStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "opportunities_application_url_https_check",
      sql`${table.applicationUrl} IS NULL OR ${table.applicationUrl} ~ '^https://'`,
    ),
    check(
      "opportunities_info_url_https_check",
      sql`${table.infoUrl} IS NULL OR ${table.infoUrl} ~ '^https://'`,
    ),
    check(
      "opportunities_image_url_https_check",
      sql`${table.imageUrl} IS NULL OR ${table.imageUrl} ~ '^https://'`,
    ),
    check(
      "opportunities_image_alt_check",
      sql`${table.imageUrl} IS NULL OR (${table.imageAlt} IS NOT NULL AND length(btrim(${table.imageAlt})) > 0)`,
    ),
    check(
      "opportunities_published_contact_check",
      sql`${table.status} <> 'published' OR (${table.applicationUrl} IS NOT NULL AND length(btrim(${table.applicationUrl})) > 0) OR (${table.contactEmail} IS NOT NULL AND length(btrim(${table.contactEmail})) > 0)`,
    ),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    personId: uuid("person_id")
      .notNull()
      .references(() => profiles.id),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    savedAt: timestamp("saved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "bookmarks_pkey",
      columns: [table.personId, table.opportunityId],
    }),
  ],
);

export type OpportunityRow = typeof opportunities.$inferSelect;
export type BookmarkRow = typeof bookmarks.$inferSelect;
