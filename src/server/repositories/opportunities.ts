import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { getDb, type AppDb } from "../../db/client";
import {
  OPPORTUNITY_TYPES,
  PUBLISH_STATUSES,
  adminAuditLogs,
  bookmarks,
  opportunities,
  profiles,
  type OpportunityRow,
  type OpportunityType,
  type PublishStatus,
} from "../../db/schema";

export type { OpportunityType };
export type OpportunityStatus = PublishStatus;

export type Opportunity = {
  id: string;
  slug: string;
  type: OpportunityType;
  title: string;
  organization: string;
  description: string;
  requirements: string | null;
  location: string | null;
  workModality: string | null;
  researchLead: string | null;
  publishedAt: Date | null;
  deadlineAt: Date | null;
  applicationUrl: string | null;
  contactEmail: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  infoUrl: string | null;
  status: OpportunityStatus;
  bookmarked: boolean;
};

export type ActiveBookmark = {
  id: string;
  slug: string;
  type: OpportunityType;
  title: string;
  organization: string;
  location: string | null;
  workModality: string | null;
  deadlineAt: Date | null;
  applicationUrl: string | null;
  contactEmail: string | null;
  infoUrl: string | null;
  status: "published";
};

export type ArchivedBookmark = {
  id: string;
  slug: string;
  type: OpportunityType;
  title: string;
  organization: string;
  status: "archived";
};

export type OpportunityBookmark = ActiveBookmark | ArchivedBookmark;

export type CreateOpportunityInput = {
  slug?: string;
  type: OpportunityType;
  title: string;
  organization: string;
  description: string;
  requirements?: string | null;
  location?: string | null;
  workModality?: string | null;
  researchLead?: string | null;
  publishedAt?: Date | null;
  deadlineAt?: Date | null;
  applicationUrl?: string | null;
  contactEmail?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  infoUrl?: string | null;
  status?: OpportunityStatus;
};

export type OpportunityError =
  | "invalid_type"
  | "invalid_status"
  | "missing_title"
  | "missing_organization"
  | "missing_description"
  | "missing_contact"
  | "invalid_application_url"
  | "invalid_contact_email"
  | "invalid_image_url"
  | "missing_image_alt"
  | "invalid_info_url"
  | "invalid_slug"
  | "duplicate_slug"
  | "missing";

export type OpportunityResult =
  | { ok: true; opportunity: Opportunity }
  | { ok: false; error: OpportunityError };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SLUG_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

const opportunityTypeSchema = z.enum(OPPORTUNITY_TYPES);
const opportunityStatusSchema = z.enum(PUBLISH_STATUSES);

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

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((value) => !value.includes(":"))
  .pipe(z.email());

const imageAltSchema = z.string().trim().min(1).max(240);
const slugSchema = z.string().trim().min(1).max(100).regex(SLUG_REGEX);

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

function cleanOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalHttpsUrl(
  value: string | null | undefined,
): { ok: true; value: string | null } | { ok: false } {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) return { ok: true, value: null };
  const parsed = httpsUrlSchema.safeParse(cleaned);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

function parseOptionalEmail(
  value: string | null | undefined,
): { ok: true; value: string | null } | { ok: false } {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) return { ok: true, value: null };
  const parsed = emailSchema.safeParse(cleaned);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

function generateSlug(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const suffix = randomUUID().slice(0, 8);
  return base ? `${base}-${suffix}` : `opportunity-${suffix}`;
}

function validateOpportunityFields(fields: {
  type: unknown;
  status: unknown;
  title: string;
  organization: string;
  description: string;
  applicationUrl: string | null | undefined;
  contactEmail: string | null | undefined;
  imageUrl: string | null | undefined;
  imageAlt: string | null | undefined;
  infoUrl: string | null | undefined;
}):
  | {
      ok: true;
      type: OpportunityType;
      status: OpportunityStatus;
      title: string;
      organization: string;
      description: string;
      applicationUrl: string | null;
      contactEmail: string | null;
      imageUrl: string | null;
      imageAlt: string | null;
      infoUrl: string | null;
    }
  | { ok: false; error: OpportunityError } {
  const parsedType = opportunityTypeSchema.safeParse(fields.type);
  if (!parsedType.success) return { ok: false, error: "invalid_type" };

  const parsedStatus = opportunityStatusSchema.safeParse(fields.status);
  if (!parsedStatus.success) return { ok: false, error: "invalid_status" };

  const application = parseOptionalHttpsUrl(fields.applicationUrl);
  if (!application.ok) return { ok: false, error: "invalid_application_url" };

  const contact = parseOptionalEmail(fields.contactEmail);
  if (!contact.ok) return { ok: false, error: "invalid_contact_email" };

  const image = parseOptionalHttpsUrl(fields.imageUrl);
  if (!image.ok) return { ok: false, error: "invalid_image_url" };

  let imageAlt: string | null = null;
  if (image.value) {
    const altParsed = imageAltSchema.safeParse(fields.imageAlt ?? "");
    if (!altParsed.success) return { ok: false, error: "missing_image_alt" };
    imageAlt = altParsed.data;
  }

  const info = parseOptionalHttpsUrl(fields.infoUrl);
  if (!info.ok) return { ok: false, error: "invalid_info_url" };

  const title = fields.title.trim();
  const organization = fields.organization.trim();
  const description = fields.description.trim();

  if (parsedStatus.data === "published") {
    if (!title) return { ok: false, error: "missing_title" };
    if (!organization) return { ok: false, error: "missing_organization" };
    if (!description) return { ok: false, error: "missing_description" };
    if (!application.value && !contact.value) {
      return { ok: false, error: "missing_contact" };
    }
  }

  return {
    ok: true,
    type: parsedType.data,
    status: parsedStatus.data,
    title,
    organization,
    description,
    applicationUrl: application.value,
    contactEmail: contact.value,
    imageUrl: image.value,
    imageAlt,
    infoUrl: info.value,
  };
}

function mapOpportunityRow(row: OpportunityRow, bookmarked: boolean): Opportunity {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title,
    organization: row.organization,
    description: row.description,
    requirements: row.requirements,
    location: row.location,
    workModality: row.workModality,
    researchLead: row.researchLead,
    publishedAt: row.publishedAt,
    deadlineAt: row.deadlineAt,
    applicationUrl: row.applicationUrl,
    contactEmail: row.contactEmail,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    infoUrl: row.infoUrl,
    status: row.status,
    bookmarked,
  };
}

function identifierWhere(opportunityIdOrSlug: string) {
  return isUuid(opportunityIdOrSlug)
    ? or(eq(opportunities.id, opportunityIdOrSlug), eq(opportunities.slug, opportunityIdOrSlug))
    : eq(opportunities.slug, opportunityIdOrSlug);
}

async function resolveDb(db?: AppDb): Promise<AppDb> {
  return db ?? (await getDb());
}

export async function listOpportunities(
  personId: string,
  typeFilter?: OpportunityType,
  db?: AppDb,
): Promise<Opportunity[]> {
  const conn = await resolveDb(db);

  const validTypeFilter = typeFilter
    ? opportunityTypeSchema.safeParse(typeFilter)
    : null;

  const whereClause =
    validTypeFilter && validTypeFilter.success
      ? and(
          eq(opportunities.status, "published"),
          eq(opportunities.type, validTypeFilter.data),
        )
      : eq(opportunities.status, "published");

  const rows = await conn
    .select()
    .from(opportunities)
    .where(whereClause)
    .orderBy(desc(opportunities.publishedAt), asc(opportunities.id));

  if (rows.length === 0) return [];

  const bookmarkedIds = new Set<string>();
  if (isUuid(personId)) {
    const bookmarkRows = await conn
      .select({ opportunityId: bookmarks.opportunityId })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.personId, personId),
          inArray(
            bookmarks.opportunityId,
            rows.map((row) => row.id),
          ),
        ),
      );
    for (const row of bookmarkRows) {
      bookmarkedIds.add(row.opportunityId);
    }
  }

  return rows.map((row) => mapOpportunityRow(row, bookmarkedIds.has(row.id)));
}

export async function getOpportunity(
  opportunityIdOrSlug: string,
  personId: string,
  db?: AppDb,
): Promise<Opportunity | undefined> {
  const key = opportunityIdOrSlug.trim();
  if (!key) return undefined;

  const conn = await resolveDb(db);

  const [row] = await conn
    .select()
    .from(opportunities)
    .where(and(identifierWhere(key), eq(opportunities.status, "published")))
    .limit(1);

  if (!row) return undefined;

  let bookmarked = false;
  if (isUuid(personId)) {
    const [existingBookmark] = await conn
      .select({ opportunityId: bookmarks.opportunityId })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.personId, personId),
          eq(bookmarks.opportunityId, row.id),
        ),
      )
      .limit(1);
    bookmarked = Boolean(existingBookmark);
  }

  return mapOpportunityRow(row, bookmarked);
}

export async function createOpportunity(
  input: CreateOpportunityInput,
  createdBy?: string | null,
  db?: AppDb,
): Promise<OpportunityResult> {
  const status = input.status ?? "draft";
  const validated = validateOpportunityFields({
    type: input.type,
    status,
    title: input.title,
    organization: input.organization,
    description: input.description,
    applicationUrl: input.applicationUrl,
    contactEmail: input.contactEmail,
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt,
    infoUrl: input.infoUrl,
  });
  if (!validated.ok) return validated;

  let slug: string;
  if (input.slug !== undefined) {
    const parsedSlug = slugSchema.safeParse(input.slug);
    if (!parsedSlug.success) return { ok: false, error: "invalid_slug" };
    slug = parsedSlug.data;
  } else {
    slug = generateSlug(validated.title);
  }

  const now = new Date();
  const publishedAt =
    validated.status === "published"
      ? (input.publishedAt ?? now)
      : (input.publishedAt ?? null);

  const conn = await resolveDb(db);

  try {
    const [inserted] = await conn
      .insert(opportunities)
      .values({
        slug,
        type: validated.type,
        title: validated.title,
        organization: validated.organization,
        description: validated.description,
        requirements: cleanOptionalText(input.requirements),
        location: cleanOptionalText(input.location),
        workModality: cleanOptionalText(input.workModality),
        researchLead: cleanOptionalText(input.researchLead),
        applicationUrl: validated.applicationUrl,
        contactEmail: validated.contactEmail,
        infoUrl: validated.infoUrl,
        imageUrl: validated.imageUrl,
        imageAlt: validated.imageAlt,
        status: validated.status,
        publishedAt,
        deadlineAt: input.deadlineAt ?? null,
        createdBy: createdBy && isUuid(createdBy) ? createdBy : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return {
      ok: true,
      opportunity: mapOpportunityRow(inserted, false),
    };
  } catch (error) {
    if (isPgErrorCode(error, "23505")) {
      return { ok: false, error: "duplicate_slug" };
    }
    throw error;
  }
}

export async function updateOpportunityStatus(
  opportunityIdOrSlug: string,
  status: OpportunityStatus,
  actorProfileId?: string | null,
  db?: AppDb,
): Promise<OpportunityResult> {
  const parsedStatus = opportunityStatusSchema.safeParse(status);
  if (!parsedStatus.success) return { ok: false, error: "invalid_status" };

  const key = opportunityIdOrSlug.trim();
  if (!key) return { ok: false, error: "missing" };

  const conn = await resolveDb(db);

  return conn.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(opportunities)
      .where(identifierWhere(key))
      .for("update");

    if (!existing) return { ok: false, error: "missing" } as const;

    if (parsedStatus.data === "published") {
      const validated = validateOpportunityFields({
        type: existing.type,
        status: "published",
        title: existing.title,
        organization: existing.organization,
        description: existing.description,
        applicationUrl: existing.applicationUrl,
        contactEmail: existing.contactEmail,
        imageUrl: existing.imageUrl,
        imageAlt: existing.imageAlt,
        infoUrl: existing.infoUrl,
      });
      if (!validated.ok) return validated;
    }

    const now = new Date();
    const publishedAt =
      parsedStatus.data === "published"
        ? (existing.publishedAt ?? now)
        : existing.publishedAt;

    const [updated] = await tx
      .update(opportunities)
      .set({
        status: parsedStatus.data,
        publishedAt,
        updatedAt: now,
      })
      .where(eq(opportunities.id, existing.id))
      .returning();

    if (actorProfileId && isUuid(actorProfileId) && existing.status !== parsedStatus.data) {
      await tx.insert(adminAuditLogs).values({
        actorProfileId,
        targetType: "opportunity",
        targetId: existing.id,
        action: "opportunity_status_updated",
        result: "success",
        metadata: {
          previousStatus: existing.status,
          newStatus: parsedStatus.data,
          slug: existing.slug,
        },
        createdAt: now,
      });
    }

    return {
      ok: true,
      opportunity: mapOpportunityRow(updated, false),
    };
  });
}

export async function saveBookmark(
  personId: string,
  opportunityIdOrSlug: string,
  db?: AppDb,
): Promise<"saved" | "missing"> {
  const key = opportunityIdOrSlug.trim();
  if (!isUuid(personId) || !key) return "missing";

  const conn = await resolveDb(db);

  return conn.transaction(async (tx) => {
    const [opportunity] = await tx
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(and(identifierWhere(key), eq(opportunities.status, "published")))
      .limit(1);

    if (!opportunity) return "missing";

    const [profile] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, personId))
      .limit(1);

    if (!profile) return "missing";

    await tx
      .insert(bookmarks)
      .values({
        personId,
        opportunityId: opportunity.id,
      })
      .onConflictDoNothing({
        target: [bookmarks.personId, bookmarks.opportunityId],
      });

    return "saved";
  });
}

export async function removeBookmark(
  personId: string,
  opportunityIdOrSlug: string,
  db?: AppDb,
): Promise<"removed"> {
  const key = opportunityIdOrSlug.trim();
  if (!isUuid(personId) || !key) return "removed";

  const conn = await resolveDb(db);

  const [opportunity] = await conn
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(identifierWhere(key))
    .limit(1);

  if (opportunity) {
    await conn
      .delete(bookmarks)
      .where(
        and(
          eq(bookmarks.personId, personId),
          eq(bookmarks.opportunityId, opportunity.id),
        ),
      );
  }

  return "removed";
}

export async function listBookmarks(
  personId: string,
  db?: AppDb,
): Promise<OpportunityBookmark[]> {
  if (!isUuid(personId)) return [];

  const conn = await resolveDb(db);

  const rows = await conn
    .select({
      id: opportunities.id,
      slug: opportunities.slug,
      type: opportunities.type,
      title: opportunities.title,
      organization: opportunities.organization,
      location: opportunities.location,
      workModality: opportunities.workModality,
      deadlineAt: opportunities.deadlineAt,
      applicationUrl: opportunities.applicationUrl,
      contactEmail: opportunities.contactEmail,
      infoUrl: opportunities.infoUrl,
      status: opportunities.status,
    })
    .from(bookmarks)
    .innerJoin(opportunities, eq(opportunities.id, bookmarks.opportunityId))
    .where(
      and(
        eq(bookmarks.personId, personId),
        inArray(opportunities.status, ["published", "archived"]),
      ),
    )
    .orderBy(desc(bookmarks.savedAt), asc(opportunities.id));

  return rows.map((row): OpportunityBookmark => {
    if (row.status === "archived") {
      return {
        id: row.id,
        slug: row.slug,
        type: row.type,
        title: row.title,
        organization: row.organization,
        status: "archived",
      };
    }

    return {
      id: row.id,
      slug: row.slug,
      type: row.type,
      title: row.title,
      organization: row.organization,
      location: row.location,
      workModality: row.workModality,
      deadlineAt: row.deadlineAt,
      applicationUrl: row.applicationUrl,
      contactEmail: row.contactEmail,
      infoUrl: row.infoUrl,
      status: "published",
    };
  });
}
