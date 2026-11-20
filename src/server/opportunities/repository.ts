/**
 * Persistencia del catálogo, edición y marcadores en PostgreSQL. Las operaciones de servidor
 * controlan el acceso y este repositorio valida los datos y audita las escrituras editoriales.
 * Véase docs/backend/opportunities.md.
 */

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type AppDb } from "../../db/client";
import { OPPORTUNITY_TYPES, PUBLISH_STATUSES, adminAuditLogs, bookmarks, opportunities, type OpportunityRow, type OpportunityType, type PublishStatus } from "../../db/schema";
import { isUuid, profileExists } from "../profiles/identity";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const opportunityTypeSchema = z.enum(OPPORTUNITY_TYPES);
const publishStatusSchema = z.enum(PUBLISH_STATUSES);

export interface AdminOpportunity {
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
  applicationUrl: string | null;
  contactEmail: string | null;
  infoUrl: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  status: PublishStatus;
  publishedAt: Date | null;
  deadlineAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminOpportunityInput {
  slug?: string;
  type: OpportunityType;
  title: string;
  organization: string;
  description: string;
  requirements?: string | null;
  location?: string | null;
  workModality?: string | null;
  modality?: string | null;
  researchLead?: string | null;
  lead?: string | null;
  applicationUrl?: string | null;
  contactEmail?: string | null;
  infoUrl?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  deadlineAt?: Date | number | null;
  deadline?: Date | number | null;
  publishedAt?: Date | number | null;
  status?: PublishStatus;
}

export type AdminOpportunityError =
  | "missing_actor"
  | "invalid_type"
  | "invalid_status"
  | "invalid_slug"
  | "duplicate_slug"
  | "missing_title"
  | "missing_organization"
  | "missing_description"
  | "missing_contact"
  | "invalid_application_url"
  | "invalid_contact_email"
  | "invalid_image_url"
  | "missing_image_alt"
  | "invalid_info_url"
  | "invalid_date"
  | "missing";

export type AdminOpportunityResult =
  | { ok: true; opportunity: AdminOpportunity }
  | { ok: false; error: AdminOpportunityError };

/**
 * Elige la conexión para las consultas y escrituras de oportunidades y marcadores.
 *
 * @param db - Conexión opcional, por ejemplo PGlite para las pruebas.
 * @returns La conexión recibida o la conexión de la aplicación.
 */
async function resolveDb(db?: AppDb): Promise<AppDb> {
  return db ?? getDb();
}

/**
 * Normaliza las fechas de publicación y cierre al crear una oportunidad.
 *
 * @param value - Date o número en milisegundos, con null o undefined si falta la fecha.
 * @returns Date válida o null si está ausente o no representa un instante válido.
 */
function toValidDate(value: Date | number | undefined | null): Date | null {
  if (value === undefined || value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Normaliza los campos opcionales del alta editorial y de los analizadores de enlace y correo.
 *
 * @param value - Texto que se recorta antes de usarlo.
 * @param maxLength - Límite opcional al que se trunca el resultado.
 * @returns El texto recortado o null si queda vacío.
 */
function cleanOptionalText(
  value: string | null | undefined,
  maxLength?: number,
): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (maxLength !== undefined && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

/**
 * Comprueba las reglas de enlaces de parseOptionalHttpsUrl.
 *
 * @param raw - URL absoluta que se comprueba.
 * @returns Si usa HTTPS, tiene un host y respeta el máximo de 2048 caracteres sin espacios ni
 *   caracteres de control.
 */
function isValidHttpsUrl(raw: string): boolean {
  if (!raw || raw.length > 2048 || /[\s\u0000-\u001f]/.test(raw)) {
    return false;
  }
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Valida los campos de solicitud, información e imagen de createAdminOpportunity.
 *
 * @param value - Texto opcional que se recorta antes de validar la URL.
 * @returns Resultado válido con la URL o null cuando está vacía, o resultado inválido.
 */
function parseOptionalHttpsUrl(
  value: string | null | undefined,
): { valid: true; url: string | null } | { valid: false } {
  const trimmed = cleanOptionalText(value);
  if (!trimmed) return { valid: true, url: null };
  return isValidHttpsUrl(trimmed)
    ? { valid: true, url: trimmed }
    : { valid: false };
}

/**
 * Valida el correo de contacto de createAdminOpportunity.
 *
 * @param value - Texto opcional que se recorta, pasa a minúsculas y comprueba como correo.
 * @returns Resultado válido con el correo o null si está vacío, o resultado inválido.
 */
function parseOptionalEmail(
  value: string | null | undefined,
): { valid: true; email: string | null } | { valid: false } {
  const trimmed = cleanOptionalText(value)?.toLowerCase() ?? null;
  if (!trimmed) return { valid: true, email: null };
  if (trimmed.length > 254) return { valid: false };
  const parsed = z.string().email().safeParse(trimmed);
  return parsed.success ? { valid: true, email: trimmed } : { valid: false };
}

/**
 * Genera el identificador de URL que usa createAdminOpportunity cuando se omite el slug.
 *
 * @param title - Título del que se obtiene la parte legible del identificador.
 * @returns Slug con prefijo normalizado y un sufijo aleatorio de ocho caracteres.
 */
function generateSlug(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const prefix = base || "item";
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

/**
 * Comprueba el identificador de URL facilitado al crear una oportunidad.
 *
 * @param raw - Slug que se recorta y pasa a minúsculas.
 * @returns Slug normalizado o null si está vacío, supera el límite o su formato es inválido.
 */
function normalizeExplicitSlug(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized.length > 100 || !SLUG_REGEX.test(normalized)) {
    return null;
  }
  return normalized;
}

/**
 * Proyecta las lecturas y los resultados de alta o cambio de estado al modelo editorial.
 *
 * @param row - Fila de PostgreSQL con los campos de oportunidad.
 * @returns Oportunidad con datos de edición, fechas, estado y autor de creación.
 */
function mapAdminOpportunity(row: OpportunityRow): AdminOpportunity {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title,
    organization: row.organization,
    description: row.description,
    requirements: row.requirements ?? null,
    location: row.location ?? null,
    workModality: row.workModality ?? null,
    researchLead: row.researchLead ?? null,
    applicationUrl: row.applicationUrl ?? null,
    contactEmail: row.contactEmail ?? null,
    infoUrl: row.infoUrl ?? null,
    imageUrl: row.imageUrl ?? null,
    imageAlt: row.imageAlt ?? null,
    status: row.status,
    publishedAt: row.publishedAt ?? null,
    deadlineAt: row.deadlineAt ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Recupera el catálogo editorial que solicita listOpportunitiesForEditing.
 *
 * @param db - Conexión opcional para leer el listado.
 * @returns Oportunidades publicadas primero, seguidas de borradores y archivadas, con orden por
 *   fechas e ID dentro de cada grupo.
 */
export async function listAdminOpportunities(
  db?: AppDb,
): Promise<AdminOpportunity[]> {
  const database = await resolveDb(db);
  const rows = await database
    .select()
    .from(opportunities)
    .orderBy(
      sql`CASE ${opportunities.status} WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END`,
      sql`${opportunities.publishedAt} DESC NULLS LAST`,
      desc(opportunities.createdAt),
      asc(opportunities.id),
    );
  return rows.map(mapAdminOpportunity);
}

/**
 * Valida y crea una oportunidad. La inserción y la auditoría ocurren en una transacción.
 *
 * @param input - Datos de alta incluidos slug opcional, fecha, estado y contacto, obligatorio
 *   para publicar.
 * @param actorProfileId - UUID del editor que debe existir y figura como creador y autor de
 *   auditoría.
 * @param db - Conexión opcional que usan las pruebas y el seed de E2E.
 * @returns Oportunidad creada o un error de validación, ausencia de actor o slug duplicado. La
 *   llama createOpportunityForEditing y se usa en pruebas y E2E.
 */
export async function createAdminOpportunity(
  input: CreateAdminOpportunityInput,
  actorProfileId: string,
  db?: AppDb,
): Promise<AdminOpportunityResult> {
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }

  const parsedType = opportunityTypeSchema.safeParse(input.type);
  if (!parsedType.success) {
    return { ok: false, error: "invalid_type" };
  }

  const parsedStatus = publishStatusSchema.safeParse(input.status ?? "draft");
  if (!parsedStatus.success) {
    return { ok: false, error: "invalid_status" };
  }

  const title = input.title?.trim() ?? "";
  const organization = input.organization?.trim() ?? "";
  const description = input.description?.trim() ?? "";
  if (!title || title.length > 160) {
    return { ok: false, error: "missing_title" };
  }
  if (!organization || organization.length > 160) {
    return { ok: false, error: "missing_organization" };
  }
  if (!description) {
    return { ok: false, error: "missing_description" };
  }

  const applicationUrl = parseOptionalHttpsUrl(input.applicationUrl);
  if (!applicationUrl.valid) {
    return { ok: false, error: "invalid_application_url" };
  }

  const contactEmail = parseOptionalEmail(input.contactEmail);
  if (!contactEmail.valid) {
    return { ok: false, error: "invalid_contact_email" };
  }

  const infoUrl = parseOptionalHttpsUrl(input.infoUrl);
  if (!infoUrl.valid) {
    return { ok: false, error: "invalid_info_url" };
  }

  const imageUrl = parseOptionalHttpsUrl(input.imageUrl);
  if (!imageUrl.valid) {
    return { ok: false, error: "invalid_image_url" };
  }

  const imageAlt = imageUrl.url
    ? cleanOptionalText(input.imageAlt, 240)
    : null;
  if (imageUrl.url && !imageAlt) {
    return { ok: false, error: "missing_image_alt" };
  }

  if (
    parsedStatus.data === "published" &&
    !applicationUrl.url &&
    !contactEmail.email
  ) {
    return { ok: false, error: "missing_contact" };
  }

  const rawDeadline =
    input.deadlineAt !== undefined ? input.deadlineAt : input.deadline;
  const deadlineAt = toValidDate(rawDeadline);
  if (rawDeadline !== undefined && rawDeadline !== null && !deadlineAt) {
    return { ok: false, error: "invalid_date" };
  }

  const rawPublishedAt = input.publishedAt;
  const parsedPublishedAt = toValidDate(rawPublishedAt);
  if (
    rawPublishedAt !== undefined &&
    rawPublishedAt !== null &&
    !parsedPublishedAt
  ) {
    return { ok: false, error: "invalid_date" };
  }

  const slug =
    input.slug !== undefined
      ? normalizeExplicitSlug(input.slug)
      : generateSlug(title);
  if (!slug) {
    return { ok: false, error: "invalid_slug" };
  }

  const database = await resolveDb(db);
  const now = new Date();
  const publishedAt =
    parsedStatus.data === "published"
      ? (parsedPublishedAt ?? now)
      : parsedPublishedAt;

  return database.transaction(async (tx) => {
    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    const [inserted] = await tx
      .insert(opportunities)
      .values({
        slug,
        type: parsedType.data,
        title,
        organization,
        description,
        requirements: cleanOptionalText(input.requirements),
        location: cleanOptionalText(input.location, 160),
        workModality: cleanOptionalText(
          input.workModality ?? input.modality,
          40,
        ),
        researchLead: cleanOptionalText(input.researchLead ?? input.lead, 160),
        applicationUrl: applicationUrl.url,
        contactEmail: contactEmail.email,
        infoUrl: infoUrl.url,
        imageUrl: imageUrl.url,
        imageAlt,
        status: parsedStatus.data,
        publishedAt,
        deadlineAt,
        createdBy: actorProfileId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: opportunities.slug })
      .returning();
    if (!inserted) return { ok: false, error: "duplicate_slug" };

    await tx.insert(adminAuditLogs).values({
      actorProfileId,
      targetType: "opportunity",
      targetId: inserted.id,
      action: "opportunity_created",
      result: "success",
      metadata: {
        slug: inserted.slug,
        type: inserted.type,
        status: inserted.status,
      },
    });

    return { ok: true, opportunity: mapAdminOpportunity(inserted) };
  });
}

/**
 * Aplica el estado pedido por changeOpportunityStatus. Bloquea la oportunidad, valida los
 * requisitos para publicar y guarda el cambio y su auditoría juntos.
 *
 * @param opportunityIdOrSlug - UUID o slug que localiza la fila que se bloquea.
 * @param status - Estado que se valida y persiste.
 * @param actorProfileId - UUID del editor que debe existir y se registra en auditoría.
 * @param db - Conexión opcional para ejecutar la transacción.
 * @returns Oportunidad actualizada o un error de validación, perfil actor ausente o registro no
 *   encontrado.
 */
export async function setAdminOpportunityStatus(
  opportunityIdOrSlug: string,
  status: PublishStatus,
  actorProfileId: string,
  db?: AppDb,
): Promise<AdminOpportunityResult> {
  const parsedStatus = publishStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { ok: false, error: "invalid_status" };
  }
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }

  const key = opportunityIdOrSlug.trim();
  if (!key) {
    return { ok: false, error: "missing" };
  }

  const database = await resolveDb(db);
  const now = new Date();

  return database.transaction(async (tx) => {
    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    const condition = isUuid(key)
      ? or(eq(opportunities.id, key), eq(opportunities.slug, key))
      : eq(opportunities.slug, key.toLowerCase());

    const [row] = await tx
      .select()
      .from(opportunities)
      .where(condition)
      .for("update");

    if (!row) return { ok: false, error: "missing" };

    if (parsedStatus.data === "published") {
      if (!row.title.trim()) return { ok: false, error: "missing_title" };
      if (!row.description.trim()) {
        return { ok: false, error: "missing_description" };
      }
      if (!row.applicationUrl?.trim() && !row.contactEmail?.trim()) {
        return { ok: false, error: "missing_contact" };
      }
      if (row.imageUrl && !row.imageAlt?.trim()) {
        return { ok: false, error: "missing_image_alt" };
      }
    }

    const [updated] = await tx
      .update(opportunities)
      .set({
        status: parsedStatus.data,
        publishedAt:
          parsedStatus.data === "published"
            ? (row.publishedAt ?? now)
            : row.publishedAt,
        updatedAt: now,
      })
      .where(eq(opportunities.id, row.id))
      .returning();

    await tx.insert(adminAuditLogs).values({
      actorProfileId,
      targetType: "opportunity",
      targetId: row.id,
      action: "opportunity_status_updated",
      result: "success",
      metadata: {
        previousStatus: row.status,
        status: parsedStatus.data,
      },
    });

    return { ok: true, opportunity: mapAdminOpportunity(updated) };
  });
}

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

/**
 * Construye el modelo compartido por las consultas de catálogo y detalle.
 *
 * @param row - Fila de la oportunidad con sus datos de catálogo.
 * @param bookmarked - Indica si la persona que consulta la tiene guardada.
 * @returns Oportunidad con datos de presentación y estado del marcador.
 */
function mapCatalogOpportunity(row: OpportunityRow, bookmarked: boolean): Opportunity {
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

/**
 * Construye el predicado Drizzle de las consultas de detalle y de las escrituras de marcadores.
 *
 * @param opportunityIdOrSlug - Identificador sin espacios exteriores que se compara por ID o
 *   slug si es UUID, y por slug en otro caso.
 * @returns Condición para localizar la oportunidad.
 */
function identifierWhere(opportunityIdOrSlug: string) {
  return isUuid(opportunityIdOrSlug)
    ? or(eq(opportunities.id, opportunityIdOrSlug), eq(opportunities.slug, opportunityIdOrSlug))
    : eq(opportunities.slug, opportunityIdOrSlug);
}

/**
 * Lee el catálogo publicado que listVisibleOpportunities entrega a la página.
 *
 * @param personId - Identificador de la persona con el que se leen sus marcadores.
 * @param typeFilter - Tipo opcional que restringe el conjunto si es válido.
 * @param db - Conexión opcional para consultar oportunidades y marcadores.
 * @returns Oportunidades publicadas ordenadas por fecha de publicación descendente, con el
 *   marcador asociado a la persona.
 */
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

  return rows.map((row) => mapCatalogOpportunity(row, bookmarkedIds.has(row.id)));
}

/**
 * Lee el detalle publicado que usa getVisibleOpportunity.
 *
 * @param opportunityIdOrSlug - ID o slug que localiza la oportunidad tras recortar el texto.
 * @param personId - Identificador de la persona que permite comprobar si tiene el marcador.
 * @param db - Conexión opcional para las lecturas.
 * @returns Oportunidad publicada con su marcador, o undefined cuando el identificador está
 *   vacío o el detalle no existe.
 */
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

  return mapCatalogOpportunity(row, bookmarked);
}

/**
 * Guarda de forma idempotente una oportunidad publicada para saveMyBookmark.
 *
 * @param personId - UUID del titular del marcador, que debe corresponder a un perfil existente.
 * @param opportunityIdOrSlug - ID o slug de la oportunidad publicada.
 * @param db - Conexión opcional para comprobar las filas e insertar en una transacción.
 * @returns saved aunque el marcador ya existiera, o missing si faltan identificadores válidos,
 *   el perfil o la oportunidad publicada.
 */
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

    if (!(await profileExists(tx, personId))) return "missing";

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

/**
 * Retira de forma idempotente el marcador solicitado por removeMyBookmark, con independencia
 * del estado editorial de la oportunidad.
 *
 * @param personId - UUID del titular cuyo marcador se retira.
 * @param opportunityIdOrSlug - ID o slug de la oportunidad del marcador.
 * @param db - Conexión opcional para la búsqueda y el borrado.
 * @returns removed también cuando el marcador ya está ausente.
 */
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

/**
 * Consulta la lista personal que devuelve listMyBookmarks, con los marcadores más recientes
 * primero.
 *
 * @param personId - UUID del titular que restringe la consulta.
 * @param db - Conexión opcional para leer los marcadores y sus oportunidades.
 * @returns Marcadores publicados con datos de contacto y archivados con datos básicos. Los
 *   borradores quedan fuera de la consulta.
 */
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
