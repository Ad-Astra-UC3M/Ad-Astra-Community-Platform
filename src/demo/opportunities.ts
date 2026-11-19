import { randomUUID } from "node:crypto";
import { db } from "./db";

export type OpportunityType = "internship" | "research";
export type OpportunityStatus = "draft" | "published" | "archived";

export type Opportunity = {
  id: string;
  type: OpportunityType;
  title: string;
  organization: string;
  description: string;
  requirements: string;
  location: string;
  modality: string;
  lead: string | null;
  publishedAt: number | null;
  deadline: number | null;
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
  type: OpportunityType;
  title: string;
  organization: string;
  location: string;
  modality: string;
  deadline: number | null;
  applicationUrl: string | null;
  contactEmail: string | null;
  infoUrl: string | null;
  status: "published";
};

export type ArchivedBookmark = {
  id: string;
  type: OpportunityType;
  title: string;
  organization: string;
  status: "archived";
};

export type OpportunityBookmark = ActiveBookmark | ArchivedBookmark;

export type CreateOpportunityInput = {
  id?: string;
  type: OpportunityType;
  title: string;
  organization: string;
  description: string;
  requirements?: string;
  location?: string;
  modality?: string;
  lead?: string | null;
  publishedAt?: number | null;
  deadline?: number | null;
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
  | "missing_description"
  | "missing_contact"
  | "invalid_application_url"
  | "invalid_contact_email"
  | "invalid_image_url"
  | "missing_image_alt"
  | "invalid_info_url"
  | "duplicate_id"
  | "missing";

export type OpportunityResult =
  | { ok: true; opportunity: Opportunity }
  | { ok: false; error: OpportunityError };

type OpportunityRow = Omit<Opportunity, "bookmarked"> & { bookmarked?: number };

const dayMs = 24 * 60 * 60 * 1000;
const seedMarkerId = "internship-flight-dynamics";

db.exec(`
  CREATE TABLE IF NOT EXISTS demo_opportunities (
    workspace_id TEXT NOT NULL,
    id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('internship', 'research')),
    title TEXT NOT NULL,
    organization TEXT NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT NOT NULL,
    location TEXT NOT NULL,
    modality TEXT NOT NULL,
    lead TEXT,
    published_at INTEGER,
    deadline INTEGER,
    application_url TEXT,
    contact_email TEXT,
    image_url TEXT,
    image_alt TEXT,
    info_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
    PRIMARY KEY (workspace_id, id),
    CHECK (image_url IS NULL OR (image_alt IS NOT NULL AND length(trim(image_alt)) > 0))
  ) STRICT;

  CREATE TABLE IF NOT EXISTS demo_opportunity_bookmarks (
    workspace_id TEXT NOT NULL,
    opportunity_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    saved_at INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, opportunity_id, person_id),
    FOREIGN KEY (workspace_id, opportunity_id) REFERENCES demo_opportunities (workspace_id, id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS demo_opportunities_workspace_status
    ON demo_opportunities (workspace_id, status, type);

  CREATE INDEX IF NOT EXISTS demo_opportunity_bookmarks_owner
    ON demo_opportunity_bookmarks (workspace_id, person_id);
`);

function writeTransaction<Result>(operation: () => Result): Result {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function isOpportunityType(value: string): value is OpportunityType {
  return value === "internship" || value === "research";
}

function isOpportunityStatus(value: string): value is OpportunityStatus {
  return value === "draft" || value === "published" || value === "archived";
}

function cleanOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function parseHttpsUrl(value: string | null | undefined): { valid: true; url: string | null } | { valid: false } {
  const trimmed = cleanOptionalText(value);
  if (!trimmed) return { valid: true, url: null };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" || !parsed.hostname) return { valid: false };
    return { valid: true, url: trimmed };
  } catch {
    return { valid: false };
  }
}

function parseEmail(value: string | null | undefined): { valid: true; email: string | null } | { valid: false } {
  const trimmed = cleanOptionalText(value)?.toLowerCase() ?? null;
  if (!trimmed) return { valid: true, email: null };
  if (trimmed.length > 254) return { valid: false };
  const [local, domain, ...extra] = trimmed.split("@");
  if (!local || !domain || extra.length > 0 || local.length > 64) return { valid: false };
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return { valid: false };
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return { valid: false };
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) {
    return { valid: false };
  }
  return { valid: true, email: trimmed };
}

function validateOpportunityFields(fields: {
  type: string;
  title: string;
  description: string;
  applicationUrl: string | null | undefined;
  contactEmail: string | null | undefined;
  imageUrl: string | null | undefined;
  imageAlt: string | null | undefined;
  infoUrl: string | null | undefined;
  status: string;
}):
  | {
      ok: true;
      type: OpportunityType;
      status: OpportunityStatus;
      title: string;
      description: string;
      applicationUrl: string | null;
      contactEmail: string | null;
      imageUrl: string | null;
      imageAlt: string | null;
      infoUrl: string | null;
    }
  | { ok: false; error: OpportunityError } {
  if (!isOpportunityType(fields.type)) return { ok: false, error: "invalid_type" };
  if (!isOpportunityStatus(fields.status)) return { ok: false, error: "invalid_status" };

  const application = parseHttpsUrl(fields.applicationUrl);
  if (!application.valid) return { ok: false, error: "invalid_application_url" };

  const email = parseEmail(fields.contactEmail);
  if (!email.valid) return { ok: false, error: "invalid_contact_email" };

  const image = parseHttpsUrl(fields.imageUrl);
  if (!image.valid) return { ok: false, error: "invalid_image_url" };

  const imageAlt = image.url ? cleanOptionalText(fields.imageAlt) : null;
  if (image.url && !imageAlt) return { ok: false, error: "missing_image_alt" };

  const info = parseHttpsUrl(fields.infoUrl);
  if (!info.valid) return { ok: false, error: "invalid_info_url" };

  const title = fields.title.trim();
  const description = fields.description.trim();

  if (fields.status === "published") {
    if (!title) return { ok: false, error: "missing_title" };
    if (!description) return { ok: false, error: "missing_description" };
    if (!application.url && !email.email) return { ok: false, error: "missing_contact" };
  }

  return {
    ok: true,
    type: fields.type,
    status: fields.status,
    title,
    description,
    applicationUrl: application.url,
    contactEmail: email.email,
    imageUrl: image.url,
    imageAlt,
    infoUrl: info.url,
  };
}

const opportunitySelectColumns = `
  opportunity.id,
  opportunity.type,
  opportunity.title,
  opportunity.organization,
  opportunity.description,
  opportunity.requirements,
  opportunity.location,
  opportunity.modality,
  opportunity.lead,
  opportunity.published_at AS publishedAt,
  opportunity.deadline,
  opportunity.application_url AS applicationUrl,
  opportunity.contact_email AS contactEmail,
  opportunity.image_url AS imageUrl,
  opportunity.image_alt AS imageAlt,
  opportunity.info_url AS infoUrl,
  opportunity.status
`;

function mapOpportunity(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    organization: row.organization,
    description: row.description,
    requirements: row.requirements,
    location: row.location,
    modality: row.modality,
    lead: row.lead,
    publishedAt: row.publishedAt,
    deadline: row.deadline,
    applicationUrl: row.applicationUrl,
    contactEmail: row.contactEmail,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    infoUrl: row.infoUrl,
    status: row.status,
    bookmarked: row.bookmarked === 1,
  };
}

export function seedOpportunities(workspaceId: string): void {
  const existing = db.prepare(
    "SELECT 1 FROM demo_opportunities WHERE workspace_id = ? AND id = ?",
  ).get(workspaceId, seedMarkerId);
  if (existing) return;

  writeTransaction(() => {
    const now = Date.now();
    const insert = db.prepare(`
      INSERT INTO demo_opportunities (
        workspace_id, id, type, title, organization, description, requirements,
        location, modality, lead, published_at, deadline, application_url,
        contact_email, image_url, image_alt, info_url, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (workspace_id, id) DO NOTHING
    `);

    insert.run(
      workspaceId,
      seedMarkerId,
      "internship",
      "Prácticas en dinámica de vuelo y control orbital",
      "Estela Aeroespacial (demo)",
      "Incorporación al equipo de análisis de misión para simular órbitas bajas, validar maniobras de apuntamiento y documentar ensayos de telemetría.",
      "Estudiante de 3.º o 4.º curso de Ingeniería Aeroespacial o afín, base en Python o MATLAB y nivel B2 de inglés.",
      "Tres Cantos, Madrid",
      "Híbrida",
      null,
      now - 3 * dayMs,
      now + 25 * dayMs,
      "https://estela-aero.example/carreras/dinamica-vuelo",
      "talento@estela-aero.example",
      null,
      null,
      "https://estela-aero.example/programas/practicas",
      "published",
    );

    insert.run(
      workspaceId,
      "research-electric-propulsion",
      "research",
      "Colaboración en investigación de propulsión eléctrica espacial",
      "Equipo de Propulsión Espacial · UC3M",
      "Línea de trabajo en laboratorio sobre diagnóstico de plasma, calibración de sensores de empuje y análisis experimental de propulsores de efecto Hall.",
      "Interés en física de plasmas o propulsión, disponibilidad de 8 horas semanales en el Campus de Leganés y manejo básico de análisis de datos.",
      "Campus de Leganés · Edificio Juan Benet",
      "Presencial",
      "Dra. Elena Navarro",
      now - 2 * dayMs,
      now + 30 * dayMs,
      null,
      "propulsion-demo@uc3m.example",
      "https://ep2.uc3m.example/media/propulsion-lab.webp",
      "Banco de ensayos de propulsión eléctrica en el laboratorio aeroespacial del campus",
      "https://ep2.uc3m.example/lineas/propulsion-electrica",
      "published",
    );

    insert.run(
      workspaceId,
      "internship-avionics-testing",
      "internship",
      "Prácticas en integración y verificación de aviónica",
      "Nadir Sistemas Espaciales (demo)",
      "Apoyo en banco de pruebas hardware-in-the-loop para computadores de a bordo, redacción de procedimientos de ensayo y seguimiento de incidencias.",
      "Conocimientos de electrónica digital, buses serie (SPI, I2C, CAN) y programación en C o Python.",
      "Getafe, Madrid",
      "Presencial",
      null,
      now - dayMs,
      now + 18 * dayMs,
      "https://nadir-espacio.example/convocatorias/avionica",
      null,
      null,
      null,
      null,
      "published",
    );
  });
}

export function listOpportunities(
  workspaceId: string,
  personId: string,
  typeFilter?: OpportunityType,
): Opportunity[] {
  seedOpportunities(workspaceId);

  const filterByType = typeFilter && isOpportunityType(typeFilter);
  const query = `
    SELECT ${opportunitySelectColumns},
      CASE WHEN bookmark.person_id IS NULL THEN 0 ELSE 1 END AS bookmarked
    FROM demo_opportunities AS opportunity
    LEFT JOIN demo_opportunity_bookmarks AS bookmark
      ON bookmark.workspace_id = opportunity.workspace_id
      AND bookmark.opportunity_id = opportunity.id
      AND bookmark.person_id = ?
    WHERE opportunity.workspace_id = ?
      AND opportunity.status = 'published'
      ${filterByType ? "AND opportunity.type = ?" : ""}
    ORDER BY opportunity.published_at DESC, opportunity.id ASC
  `;

  const rows = (
    filterByType
      ? db.prepare(query).all(personId, workspaceId, typeFilter)
      : db.prepare(query).all(personId, workspaceId)
  ) as unknown as OpportunityRow[];

  return rows.map(mapOpportunity);
}

export function getOpportunity(
  workspaceId: string,
  opportunityId: string,
  personId: string,
): Opportunity | undefined {
  seedOpportunities(workspaceId);

  const row = db.prepare(`
    SELECT ${opportunitySelectColumns},
      CASE WHEN bookmark.person_id IS NULL THEN 0 ELSE 1 END AS bookmarked
    FROM demo_opportunities AS opportunity
    LEFT JOIN demo_opportunity_bookmarks AS bookmark
      ON bookmark.workspace_id = opportunity.workspace_id
      AND bookmark.opportunity_id = opportunity.id
      AND bookmark.person_id = ?
    WHERE opportunity.workspace_id = ?
      AND opportunity.id = ?
      AND opportunity.status = 'published'
  `).get(personId, workspaceId, opportunityId) as unknown as OpportunityRow | undefined;

  return row ? mapOpportunity(row) : undefined;
}

export function createOpportunity(
  workspaceId: string,
  input: CreateOpportunityInput,
): OpportunityResult {
  const status = input.status ?? "draft";
  const validated = validateOpportunityFields({
    type: input.type,
    title: input.title,
    description: input.description,
    applicationUrl: input.applicationUrl,
    contactEmail: input.contactEmail,
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt,
    infoUrl: input.infoUrl,
    status,
  });
  if (!validated.ok) return validated;

  const id = cleanOptionalText(input.id) ?? randomUUID();
  const organization = input.organization.trim();
  const requirements = input.requirements?.trim() ?? "";
  const location = input.location?.trim() ?? "";
  const modality = input.modality?.trim() ?? "";
  const lead = cleanOptionalText(input.lead);
  const publishedAt = validated.status === "published" ? (input.publishedAt ?? Date.now()) : (input.publishedAt ?? null);
  const deadline = input.deadline ?? null;

  return writeTransaction(() => {
    const existing = db.prepare(
      "SELECT 1 FROM demo_opportunities WHERE workspace_id = ? AND id = ?",
    ).get(workspaceId, id);
    if (existing) return { ok: false, error: "duplicate_id" } as const;

    db.prepare(`
      INSERT INTO demo_opportunities (
        workspace_id, id, type, title, organization, description, requirements,
        location, modality, lead, published_at, deadline, application_url,
        contact_email, image_url, image_alt, info_url, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      workspaceId,
      id,
      validated.type,
      validated.title,
      organization,
      validated.description,
      requirements,
      location,
      modality,
      lead,
      publishedAt,
      deadline,
      validated.applicationUrl,
      validated.contactEmail,
      validated.imageUrl,
      validated.imageAlt,
      validated.infoUrl,
      validated.status,
    );

    return {
      ok: true,
      opportunity: {
        id,
        type: validated.type,
        title: validated.title,
        organization,
        description: validated.description,
        requirements,
        location,
        modality,
        lead,
        publishedAt,
        deadline,
        applicationUrl: validated.applicationUrl,
        contactEmail: validated.contactEmail,
        imageUrl: validated.imageUrl,
        imageAlt: validated.imageAlt,
        infoUrl: validated.infoUrl,
        status: validated.status,
        bookmarked: false,
      },
    };
  });
}

export function updateOpportunityStatus(
  workspaceId: string,
  opportunityId: string,
  status: OpportunityStatus,
): OpportunityResult {
  if (!isOpportunityStatus(status)) return { ok: false, error: "invalid_status" };
  seedOpportunities(workspaceId);

  return writeTransaction(() => {
    const row = db.prepare(`
      SELECT ${opportunitySelectColumns}
      FROM demo_opportunities AS opportunity
      WHERE opportunity.workspace_id = ? AND opportunity.id = ?
    `).get(workspaceId, opportunityId) as unknown as OpportunityRow | undefined;

    if (!row) return { ok: false, error: "missing" } as const;

    if (status === "published") {
      const validated = validateOpportunityFields({
        type: row.type,
        title: row.title,
        description: row.description,
        applicationUrl: row.applicationUrl,
        contactEmail: row.contactEmail,
        imageUrl: row.imageUrl,
        imageAlt: row.imageAlt,
        infoUrl: row.infoUrl,
        status: "published",
      });
      if (!validated.ok) return validated;

      const publishedAt = row.publishedAt ?? Date.now();
      db.prepare(`
        UPDATE demo_opportunities
        SET status = 'published', published_at = ?
        WHERE workspace_id = ? AND id = ?
      `).run(publishedAt, workspaceId, opportunityId);

      return {
        ok: true,
        opportunity: mapOpportunity({ ...row, status: "published", publishedAt }),
      };
    }

    db.prepare(`
      UPDATE demo_opportunities
      SET status = ?
      WHERE workspace_id = ? AND id = ?
    `).run(status, workspaceId, opportunityId);

    return {
      ok: true,
      opportunity: mapOpportunity({ ...row, status }),
    };
  });
}

export function saveBookmark(
  workspaceId: string,
  personId: string,
  opportunityId: string,
): "saved" | "missing" {
  seedOpportunities(workspaceId);

  return writeTransaction(() => {
    const published = db.prepare(`
      SELECT 1 FROM demo_opportunities
      WHERE workspace_id = ? AND id = ? AND status = 'published'
    `).get(workspaceId, opportunityId);
    if (!published) return "missing";

    db.prepare(`
      INSERT INTO demo_opportunity_bookmarks (workspace_id, opportunity_id, person_id, saved_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (workspace_id, opportunity_id, person_id) DO NOTHING
    `).run(workspaceId, opportunityId, personId, Date.now());
    return "saved";
  });
}

export function removeBookmark(
  workspaceId: string,
  personId: string,
  opportunityId: string,
): "removed" {
  writeTransaction(() => {
    db.prepare(`
      DELETE FROM demo_opportunity_bookmarks
      WHERE workspace_id = ? AND opportunity_id = ? AND person_id = ?
    `).run(workspaceId, opportunityId, personId);
  });
  return "removed";
}

export function listBookmarks(workspaceId: string, personId: string): OpportunityBookmark[] {
  seedOpportunities(workspaceId);

  const rows = db.prepare(`
    SELECT
      opportunity.id,
      opportunity.type,
      opportunity.title,
      opportunity.organization,
      opportunity.location,
      opportunity.modality,
      opportunity.deadline,
      opportunity.application_url AS applicationUrl,
      opportunity.contact_email AS contactEmail,
      opportunity.info_url AS infoUrl,
      opportunity.status
    FROM demo_opportunity_bookmarks AS bookmark
    JOIN demo_opportunities AS opportunity
      ON opportunity.workspace_id = bookmark.workspace_id
      AND opportunity.id = bookmark.opportunity_id
    WHERE bookmark.workspace_id = ?
      AND bookmark.person_id = ?
      AND opportunity.status IN ('published', 'archived')
    ORDER BY bookmark.saved_at DESC, opportunity.id ASC
  `).all(workspaceId, personId) as unknown as Array<{
    id: string;
    type: OpportunityType;
    title: string;
    organization: string;
    location: string;
    modality: string;
    deadline: number | null;
    applicationUrl: string | null;
    contactEmail: string | null;
    infoUrl: string | null;
    status: "published" | "archived";
  }>;

  return rows.map((row): OpportunityBookmark => {
    if (row.status === "archived") {
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        organization: row.organization,
        status: "archived",
      };
    }

    return {
      id: row.id,
      type: row.type,
      title: row.title,
      organization: row.organization,
      location: row.location,
      modality: row.modality,
      deadline: row.deadline,
      applicationUrl: row.applicationUrl,
      contactEmail: row.contactEmail,
      infoUrl: row.infoUrl,
      status: "published",
    };
  });
}
