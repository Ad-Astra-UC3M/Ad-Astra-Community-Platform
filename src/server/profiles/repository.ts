/**
 * Persistencia del perfil básico, el talento voluntario y las decisiones de difusión. Las
 * operaciones aportan el titular autenticado y este módulo valida, transforma y guarda los
 * datos. Véase docs/backend/profiles.md.
 */

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type AppDb, type AppDbOrTx } from "../../db/client";
import {
  TALENT_EXPERIENCE_KINDS,
  TALENT_LINK_KINDS,
  profiles,
  talentDisseminationDecisions,
  talentProfiles,
  type AccountStatus,
  type ProfileRow,
  type TalentExperience,
  type TalentExperienceKind,
  type TalentLanguage,
  type TalentLink,
  type TalentLinkKind,
} from "../../db/schema";
import { isUuid, profileExists } from "./identity";

export {
  TALENT_EXPERIENCE_KINDS,
  TALENT_LINK_KINDS,
  type AccountStatus,
  type TalentExperienceKind,
  type TalentLanguage,
  type TalentLink,
  type TalentLinkKind,
};

export const DISSEMINATION_PURPOSE = "internal_and_future_talent_sharing";
export const DISSEMINATION_POLICY_VERSION = "talent-diffusion-v1";

const MAX_TAGS_PER_CATEGORY = 20;
const MAX_TAG_LENGTH = 60;
const MAX_LINKS = 10;
const MAX_EXPERIENCES = 30;
const MAX_LANGUAGES = 20;

const DEFAULT_LINK_LABELS: Record<TalentLinkKind, string> = {
  cv: "CV",
  linkedin: "LinkedIn",
  github: "GitHub",
  portfolio: "Portfolio",
  other: "Enlace externo",
};

const talentLinkKindSchema = z.enum(TALENT_LINK_KINDS);

export interface BasicProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  degree: string;
  academicLevel: string | null;
  languageModality: string | null;
  course: string;
  status: AccountStatus;
  privacyVersion: string;
  privacyAcceptedAt: Date;
  emailVerifiedAt: Date | null;
  avatarUpdatedAt: Date | null;
}

export interface BasicProfileUpdateInput {
  firstName: string;
  lastName: string;
  degree: string;
  course: string;
  academicLevel?: string | null;
  languageModality?: string | null;
  email?: string;
  id?: string;
  status?: string;
  authUserId?: string;
  role?: string;
}

export type BasicProfileUpdateError =
  | "missing"
  | "email_immutable"
  | "identity_immutable"
  | "fields";

export type BasicProfileUpdateResult =
  | { ok: true; profile: BasicProfile }
  | { ok: false; error: BasicProfileUpdateError };

export interface TalentExperienceItem {
  kind: TalentExperienceKind;
  title: string;
  organization: string | null;
  description: string | null;
  isFeatured: boolean;
  sortOrder: number;
}

export interface TalentExperienceInput {
  kind: TalentExperienceKind;
  title: string;
  organization?: string | null;
  description?: string | null;
  isFeatured?: boolean;
  sortOrder?: number;
}

export interface TalentLinkInput {
  kind: TalentLinkKind;
  label?: string;
  url: string;
}

export interface TalentProfile {
  personId: string;
  university: string;
  expectedGraduationYear: number | null;
  headline: string;
  skills: string[];
  tools: string[];
  interests: string[];
  sectors: string[];
  opportunityTypes: string[];
  experiences: TalentExperienceItem[];
  languages: TalentLanguage[];
  links: TalentLink[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface TalentProfileInput {
  university?: string | null;
  expectedGraduationYear?: number | string | null;
  graduationYear?: number | string | null;
  headline?: string | null;
  skills?: readonly string[];
  tools?: readonly string[];
  interests?: readonly string[];
  sectors?: readonly string[];
  opportunityTypes?: readonly string[];
  experiences?: readonly TalentExperienceInput[];
  experiencesSummary?: string | null;
  featuredProject?: string | null;
  languages?: readonly TalentLanguage[] | readonly string[] | string;
  links?: readonly TalentLinkInput[];
}

export type TalentProfileSaveError =
  | "missing"
  | "invalid_year"
  | "invalid_url"
  | "invalid_link_kind"
  | "invalid_experiences"
  | "invalid_languages"
  | "duplicate_language"
  | "fields";

export type TalentProfileSaveResult =
  | { ok: true; profile: TalentProfile }
  | { ok: false; error: TalentProfileSaveError };

export interface DisseminationDecision {
  id: string;
  purpose: string;
  policyVersion: string;
  granted: boolean;
  source: string;
  validUntil: Date | null;
  decidedAt: Date;
}

export interface DisseminationStatus {
  purpose: string;
  policyVersion: string;
  granted: boolean;
  expired: boolean;
  validUntil: Date | null;
  decidedAt: Date | null;
  history: DisseminationDecision[];
}

export interface SetDisseminationOptions {
  validUntil?: Date | null;
  now?: Date;
  source?: string;
}

const basicProfileEditableSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(120),
  degree: z.string().trim().min(1).max(120),
  course: z.string().trim().min(1).max(40),
  academicLevel: z
    .string()
    .trim()
    .max(40)
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .optional(),
  languageModality: z
    .string()
    .trim()
    .max(40)
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .optional(),
});

const talentExperienceSchema = z.object({
  kind: z.enum(TALENT_EXPERIENCE_KINDS),
  title: z.string().trim().min(1).max(160),
  organization: z
    .string()
    .trim()
    .max(160)
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const talentLanguageSchema = z.object({
  language: z.string().trim().min(1).max(60),
  level: z.string().trim().min(1).max(60),
});

const optionalUniversitySchema = z
  .string()
  .trim()
  .max(160)
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

const optionalHeadlineSchema = z
  .string()
  .trim()
  .max(200)
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

/**
 * Elige la conexión de las lecturas y escrituras de perfil y difusión.
 *
 * @param db - Conexión opcional, como PGlite en una prueba.
 * @returns La conexión inyectada o la configurada en la aplicación.
 */
async function resolveDb(db?: AppDb): Promise<AppDb> {
  return db ?? getDb();
}

/**
 * Proyecta campos de perfil básico tras leer o escribir una fila en getBasicProfile y
 * updateBasicProfile.
 *
 * @param row - Registro de profiles que sirve de origen.
 * @returns Perfil básico con null para los campos opcionales sin valor.
 */
function toBasicProfile(row: ProfileRow): BasicProfile {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    degree: row.degree,
    academicLevel: row.academicLevel ?? null,
    languageModality: row.languageModality ?? null,
    course: row.course,
    status: row.status,
    privacyVersion: row.privacyVersion,
    privacyAcceptedAt: row.privacyAcceptedAt,
    emailVerifiedAt: row.emailVerifiedAt ?? null,
    avatarUpdatedAt: row.avatarUpdatedAt ?? null,
  };
}

/**
 * Convierte las experiencias JSONB al modelo que consumen readTalentProfileRow y el detalle
 * interno.
 *
 * @param item - Experiencia almacenada con claves como is_featured y sort_order.
 * @returns Experiencia con sus claves de aplicación y null para organización y descripción
 *   ausentes.
 */
export function mapExperienceFromDb(item: TalentExperience): TalentExperienceItem {
  return {
    kind: item.kind,
    title: item.title,
    organization: item.organization ?? null,
    description: item.description ?? null,
    isFeatured: item.is_featured,
    sortOrder: item.sort_order,
  };
}

/**
 * Adapta una experiencia validada antes de insertarla en saveTalentProfile.
 *
 * @param item - Experiencia con las claves isFeatured y sortOrder de la aplicación.
 * @returns Experiencia con las claves del formato JSONB persistido.
 */
function mapExperienceToDb(item: TalentExperienceItem): TalentExperience {
  return {
    kind: item.kind,
    title: item.title,
    organization: item.organization,
    description: item.description,
    is_featured: item.isFeatured,
    sort_order: item.sortOrder,
  };
}

/**
 * Aplica las reglas de formato de enlace al guardar el perfil de talento.
 *
 * @param raw - URL recortada que se valida.
 * @returns Si es absoluta, usa HTTP o HTTPS, tiene host y respeta el máximo de 2048 caracteres
 *   sin espacios ni controles.
 */
function isSafeHttpUrl(raw: string): boolean {
  if (!raw || raw.length > 2048 || /[\s\u0000-\u001f]/.test(raw)) {
    return false;
  }
  try {
    const parsed = new URL(raw);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Normaliza las etiquetas de los formularios y de la búsqueda de talento.
 *
 * @param tags - Lista opcional cuyos elementos se recortan y pasan a minúsculas.
 * @returns Etiquetas sin vacíos ni duplicados en orden de primera aparición.
 */
export function normalizeTagList(tags: readonly string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
  }

  return normalized;
}

/**
 * Interpreta los campos de etiquetas que lee saveTalentProfileAction.
 *
 * @param raw - Texto que se divide por comas o saltos de línea.
 * @returns Etiquetas normalizadas para enviarlas a la operación de guardado.
 */
export function parseTagList(raw: string): string[] {
  if (!raw) return [];
  return normalizeTagList(raw.split(/[,\n]/));
}

/**
 * Valida una categoría de etiquetas antes de guardarla en saveTalentProfile.
 *
 * @param tags - Etiquetas opcionales que se normalizan y deduplican.
 * @returns Lista válida o null si un valor no es texto, supera 60 caracteres o hay más de 20
 *   etiquetas distintas.
 */
function validateTagCategory(
  tags: readonly string[] | undefined,
): string[] | null {
  if (!tags) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of tags) {
    if (typeof raw !== "string") return null;
    const tag = raw.trim().toLowerCase();
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) return null;
    if (seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
    if (normalized.length > MAX_TAGS_PER_CATEGORY) return null;
  }

  return normalized;
}

/**
 * Interpreta el texto de idiomas de saveTalentProfileAction y las entradas textuales
 * compatibles del repositorio.
 *
 * @param raw - Texto separado por comas o saltos de línea, o lista de textos. El nivel puede ir
 *   entre paréntesis o separado por guion o dos puntos.
 * @returns Pares de idioma y nivel con «No especificado» cuando falta el nivel.
 */
export function parseLanguageList(
  raw: string | readonly string[],
): TalentLanguage[] {
  const entries =
    typeof raw === "string"
      ? raw.split(/[,\n]/)
      : Array.from(raw);

  const parsed: TalentLanguage[] = [];
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const parenMatch = /^(.+?)\s*\(([^()]+)\)$/.exec(trimmed);
    if (parenMatch) {
      parsed.push({
        language: parenMatch[1].trim(),
        level: parenMatch[2].trim(),
      });
      continue;
    }

    const sepMatch = /^(.+?)\s*[-:]\s*(.+)$/.exec(trimmed);
    if (sepMatch) {
      parsed.push({
        language: sepMatch[1].trim(),
        level: sepMatch[2].trim(),
      });
      continue;
    }

    parsed.push({
      language: trimmed,
      level: "No especificado",
    });
  }

  return parsed;
}

/**
 * Convierte los campos de texto del formulario en el formato estructurado de saveTalentProfile.
 *
 * @param input - Resumen libre y proyecto destacado opcionales. Se recortan y se usan como
 *   descripciones.
 * @returns Experiencias en orden, con el proyecto marcado como destacado si se indicó.
 */
export function parseExperiencesFromText(input: {
  experiencesSummary?: string | null;
  featuredProject?: string | null;
}): TalentExperienceItem[] {
  const items: TalentExperienceItem[] = [];
  const featured = input.featuredProject?.trim() ?? "";
  const summary = input.experiencesSummary?.trim() ?? "";

  if (featured) {
    items.push({
      kind: "project",
      title: "Proyecto destacado",
      organization: null,
      description: featured,
      isFeatured: true,
      sortOrder: items.length,
    });
  }
  if (summary) {
    items.push({
      kind: "work",
      title: "Resumen de experiencia",
      organization: null,
      description: summary,
      isFeatured: false,
      sortOrder: items.length,
    });
  }
  return items;
}

/**
 * Valida el año de graduación que se guarda en el perfil de talento.
 *
 * @param value - Número, texto de cuatro dígitos o valor opcional.
 * @returns Resultado válido con un entero entre 1950 y 2100 o null para un valor vacío, o
 *   resultado inválido.
 */
function parseExpectedGraduationYear(
  value: number | string | null | undefined,
): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { ok: true, value: null };
    if (!/^\d{4}$/.test(trimmed)) return { ok: false };
    const year = Number(trimmed);
    return year >= 1950 && year <= 2100
      ? { ok: true, value: year }
      : { ok: false };
  }
  if (!Number.isInteger(value) || value < 1950 || value > 2100) {
    return { ok: false };
  }
  return { ok: true, value };
}

/**
 * Proyecta la fila de talento para getTalentProfile y la relee tras saveTalentProfile.
 *
 * @param db - Conexión de lectura o transacción que acaba de guardar la fila.
 * @param personId - UUID del titular con el que se busca la fila de talento.
 * @returns Perfil con experiencias ordenadas o modelo vacío si el usuario todavía no guardó su
 *   perfil.
 */
async function readTalentProfileRow(
  db: AppDbOrTx,
  personId: string,
): Promise<TalentProfile> {
  const [row] = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.personId, personId))
    .limit(1);

  if (!row) {
    return {
      personId,
      university: "",
      expectedGraduationYear: null,
      headline: "",
      skills: [],
      tools: [],
      interests: [],
      sectors: [],
      opportunityTypes: [],
      experiences: [],
      languages: [],
      links: [],
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    personId: row.personId,
    university: row.university ?? "",
    expectedGraduationYear: row.expectedGraduationYear ?? null,
    headline: row.headline ?? "",
    skills: [...row.skills],
    tools: [...row.tools],
    interests: [...row.interests],
    sectors: [...row.sectors],
    opportunityTypes: [...row.opportunityTypes],
    experiences: row.experiences
      .map(mapExperienceFromDb)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    languages: row.languages.map((entry) => ({ ...entry })),
    links: row.links.map((entry) => ({ ...entry })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Recupera los datos básicos que usa getMyProfile para la página.
 *
 * @param personId - UUID consultado en profiles.
 * @param db - Conexión opcional de lectura.
 * @returns Perfil básico o null si el UUID es inválido o falta la fila.
 */
export async function getBasicProfile(
  personId: string,
  db?: AppDb,
): Promise<BasicProfile | null> {
  if (!isUuid(personId)) return null;
  const database = await resolveDb(db);
  const [row] = await database
    .select()
    .from(profiles)
    .where(eq(profiles.id, personId))
    .limit(1);
  return row ? toBasicProfile(row) : null;
}

/**
 * Valida y actualiza el perfil básico que recibe de updateMyProfile. Bloquea la fila para
 * mantener identidad y correo, y conserva los datos académicos opcionales omitidos.
 *
 * @param personId - UUID del perfil que se bloquea y modifica.
 * @param input - Campos editables y campos de identidad opcionales que se contrastan con el
 *   registro existente.
 * @param db - Conexión opcional para la transacción.
 * @returns Perfil actualizado o un error por ausencia del perfil, cambio de identidad o correo,
 *   o datos inválidos.
 */
export async function updateBasicProfile(
  personId: string,
  input: BasicProfileUpdateInput,
  db?: AppDb,
): Promise<BasicProfileUpdateResult> {
  if (!isUuid(personId)) return { ok: false, error: "missing" };
  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.id, personId))
      .for("update");

    if (!existing) return { ok: false, error: "missing" };

    if (
      input.email !== undefined &&
      input.email.trim().toLowerCase() !== existing.email.toLowerCase()
    ) {
      return { ok: false, error: "email_immutable" };
    }

    if (
      (input.id !== undefined && input.id !== existing.id) ||
      (input.status !== undefined && input.status !== existing.status) ||
      (input.authUserId !== undefined &&
        input.authUserId !== existing.authUserId) ||
      input.role !== undefined
    ) {
      return { ok: false, error: "identity_immutable" };
    }

    const parsed = basicProfileEditableSchema.safeParse({
      firstName: input.firstName,
      lastName: input.lastName,
      degree: input.degree,
      course: input.course,
      academicLevel: input.academicLevel,
      languageModality: input.languageModality,
    });

    if (!parsed.success) {
      return { ok: false, error: "fields" };
    }

    const [updated] = await tx
      .update(profiles)
      .set({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        degree: parsed.data.degree,
        course: parsed.data.course,
        academicLevel:
          parsed.data.academicLevel === undefined
            ? existing.academicLevel
            : parsed.data.academicLevel,
        languageModality:
          parsed.data.languageModality === undefined
            ? existing.languageModality
            : parsed.data.languageModality,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, personId))
      .returning();

    return { ok: true, profile: toBasicProfile(updated) };
  });
}

/**
 * Lee el perfil propio que solicita getMyTalentProfile tras comprobar la coincidencia de
 * identificadores y la existencia del titular.
 *
 * @param requesterId - UUID de quien solicita la lectura.
 * @param targetPersonId - UUID del titular cuyo perfil se lee si coincide con requesterId.
 * @param db - Conexión opcional de lectura.
 * @returns Datos de talento, vacíos antes del primer guardado, o null si el titular no existe o
 *   no coincide con el solicitante.
 */
export async function getTalentProfile(
  requesterId: string,
  targetPersonId: string,
  db?: AppDb,
): Promise<TalentProfile | null> {
  if (requesterId !== targetPersonId) return null;
  if (!isUuid(targetPersonId)) return null;
  const database = await resolveDb(db);
  if (!(await profileExists(database, targetPersonId))) return null;
  return readTalentProfileRow(database, targetPersonId);
}

/**
 * Guarda el perfil enviado por saveMyTalentProfile. Valida los datos y crea o actualiza una
 * única fila por titular dentro de una transacción.
 *
 * @param personId - UUID del titular del perfil básico que se comprueba antes de escribir.
 * @param input - Formación, etiquetas, experiencias, idiomas y enlaces. Admite los formatos
 *   textuales de año, experiencias e idiomas.
 * @param db - Conexión opcional para guardar y releer el perfil en la misma transacción.
 * @returns Perfil guardado o un error de campos, formato o ausencia del titular.
 */
export async function saveTalentProfile(
  personId: string,
  input: TalentProfileInput,
  db?: AppDb,
): Promise<TalentProfileSaveResult> {
  if (!isUuid(personId)) return { ok: false, error: "missing" };
  const database = await resolveDb(db);

  const universityParsed = optionalUniversitySchema.safeParse(input.university);
  const headlineParsed = optionalHeadlineSchema.safeParse(input.headline);
  if (!universityParsed.success || !headlineParsed.success) {
    return { ok: false, error: "fields" };
  }

  const rawYear =
    input.expectedGraduationYear !== undefined
      ? input.expectedGraduationYear
      : input.graduationYear;
  const parsedYear = parseExpectedGraduationYear(rawYear);
  if (!parsedYear.ok) {
    return { ok: false, error: "invalid_year" };
  }

  const skills = validateTagCategory(input.skills);
  const tools = validateTagCategory(input.tools);
  const interests = validateTagCategory(input.interests);
  const sectors = validateTagCategory(input.sectors);
  const opportunityTypes = validateTagCategory(input.opportunityTypes);
  if (!skills || !tools || !interests || !sectors || !opportunityTypes) {
    return { ok: false, error: "fields" };
  }

  // Validate experiences (structured JSONB or legacy text fields)
  const rawExperiences =
    input.experiences !== undefined
      ? input.experiences
      : input.experiencesSummary !== undefined ||
          input.featuredProject !== undefined
        ? parseExperiencesFromText({
            experiencesSummary: input.experiencesSummary,
            featuredProject: input.featuredProject,
          })
        : [];

  if (!Array.isArray(rawExperiences) || rawExperiences.length > MAX_EXPERIENCES) {
    return { ok: false, error: "invalid_experiences" };
  }

  const normalizedExperiences: TalentExperienceItem[] = [];
  for (let index = 0; index < rawExperiences.length; index++) {
    const parsed = talentExperienceSchema.safeParse(rawExperiences[index]);
    if (!parsed.success) {
      return { ok: false, error: "invalid_experiences" };
    }
    normalizedExperiences.push({
      kind: parsed.data.kind,
      title: parsed.data.title,
      organization: parsed.data.organization,
      description: parsed.data.description,
      isFeatured: parsed.data.isFeatured ?? false,
      sortOrder: parsed.data.sortOrder ?? index,
    });
  }

  // Validate languages (structured JSONB or text helper)
  let rawLanguages: readonly unknown[] = [];
  if (typeof input.languages === "string") {
    rawLanguages = parseLanguageList(input.languages);
  } else if (Array.isArray(input.languages)) {
    if (
      input.languages.length > 0 &&
      input.languages.every((item) => typeof item === "string")
    ) {
      rawLanguages = parseLanguageList(input.languages as readonly string[]);
    } else {
      rawLanguages = input.languages;
    }
  } else if (input.languages !== undefined) {
    return { ok: false, error: "invalid_languages" };
  }

  if (rawLanguages.length > MAX_LANGUAGES) {
    return { ok: false, error: "invalid_languages" };
  }

  const normalizedLanguages: TalentLanguage[] = [];
  const seenLanguages = new Set<string>();
  for (const item of rawLanguages) {
    const parsed = talentLanguageSchema.safeParse(item);
    if (!parsed.success) {
      return { ok: false, error: "invalid_languages" };
    }
    const normalizedKey = parsed.data.language.toLowerCase();
    if (seenLanguages.has(normalizedKey)) {
      return { ok: false, error: "duplicate_language" };
    }
    seenLanguages.add(normalizedKey);
    normalizedLanguages.push({
      language: parsed.data.language,
      level: parsed.data.level,
    });
  }

  // Validate links (only absolute http:// or https://)
  const rawLinks = input.links ?? [];
  if (!Array.isArray(rawLinks) || rawLinks.length > MAX_LINKS) {
    return { ok: false, error: "fields" };
  }

  const normalizedLinks: TalentLink[] = [];
  for (const link of rawLinks) {
    if (!link || typeof link !== "object") {
      return { ok: false, error: "invalid_link_kind" };
    }
    const parsedKind = talentLinkKindSchema.safeParse(link.kind);
    if (!parsedKind.success) {
      return { ok: false, error: "invalid_link_kind" };
    }
    const kind = parsedKind.data;
    const url = typeof link.url === "string" ? link.url.trim() : "";
    if (!isSafeHttpUrl(url)) {
      return { ok: false, error: "invalid_url" };
    }
    const label =
      link.label === undefined
        ? DEFAULT_LINK_LABELS[kind]
        : typeof link.label === "string"
          ? link.label.trim()
          : "";
    if (!label || label.length > 80) {
      return { ok: false, error: "fields" };
    }
    normalizedLinks.push({ kind, label, url });
  }

  const now = new Date();
  const dbExperiences = normalizedExperiences.map(mapExperienceToDb);

  return database.transaction(async (tx) => {
    if (!(await profileExists(tx, personId))) {
      return { ok: false, error: "missing" };
    }

    await tx
      .insert(talentProfiles)
      .values({
        personId,
        university: universityParsed.data ?? null,
        expectedGraduationYear: parsedYear.value,
        headline: headlineParsed.data ?? null,
        skills,
        tools,
        interests,
        sectors,
        opportunityTypes,
        experiences: dbExperiences,
        languages: normalizedLanguages,
        links: normalizedLinks,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: talentProfiles.personId,
        set: {
          university: universityParsed.data ?? null,
          expectedGraduationYear: parsedYear.value,
          headline: headlineParsed.data ?? null,
          skills,
          tools,
          interests,
          sectors,
          opportunityTypes,
          experiences: dbExperiences,
          languages: normalizedLanguages,
          links: normalizedLinks,
          updatedAt: now,
        },
      });

    const saved = await readTalentProfileRow(tx, personId);
    return { ok: true, profile: saved };
  });
}

/**
 * Calcula la difusión vigente que usan getDisseminationStatus y setDisseminationDecision.
 *
 * @param db - Conexión o transacción que consulta las decisiones del propósito de difusión.
 * @param personId - UUID del titular de las decisiones.
 * @param now - Instante con el que se compara la vigencia de la última concesión.
 * @returns Estado efectivo, caducidad e historial de decisiones de más reciente a más antigua.
 */
async function readDisseminationStatus(
  db: AppDbOrTx,
  personId: string,
  now: Date,
): Promise<DisseminationStatus> {
  if (!isUuid(personId)) {
    return {
      purpose: DISSEMINATION_PURPOSE,
      policyVersion: DISSEMINATION_POLICY_VERSION,
      granted: false,
      expired: false,
      validUntil: null,
      decidedAt: null,
      history: [],
    };
  }

  const rows = await db
    .select()
    .from(talentDisseminationDecisions)
    .where(
      and(
        eq(talentDisseminationDecisions.personId, personId),
        eq(talentDisseminationDecisions.purpose, DISSEMINATION_PURPOSE),
      ),
    )
    .orderBy(
      desc(talentDisseminationDecisions.decidedAt),
      desc(talentDisseminationDecisions.id),
    );

  const history: DisseminationDecision[] = rows.map((row) => ({
    id: row.id,
    purpose: row.purpose,
    policyVersion: row.policyVersion,
    granted: row.granted,
    source: row.source,
    validUntil: row.validUntil ?? null,
    decidedAt: row.decidedAt,
  }));

  const latest = history[0];
  const expired = Boolean(
    latest?.granted &&
      latest.validUntil !== null &&
      latest.validUntil.getTime() <= now.getTime(),
  );
  const granted = Boolean(latest && latest.granted && !expired);

  return {
    purpose: latest?.purpose ?? DISSEMINATION_PURPOSE,
    policyVersion: latest?.policyVersion ?? DISSEMINATION_POLICY_VERSION,
    granted,
    expired,
    validUntil: latest?.validUntil ?? null,
    decidedAt: latest?.decidedAt ?? null,
    history,
  };
}

/**
 * Lee el estado de difusión que getMyPrivacySettings entrega a la página de privacidad.
 *
 * @param personId - UUID de la persona cuyas decisiones se consultan.
 * @param now - Instante de referencia para evaluar si la última concesión ha caducado.
 * @param db - Conexión opcional para la lectura.
 * @returns Estado de difusión e historial del titular.
 */
export async function getDisseminationStatus(
  personId: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<DisseminationStatus> {
  const database = await resolveDb(db);
  return readDisseminationStatus(database, personId, now);
}

/**
 * Registra la decisión solicitada por updateMyDissemination. Bloquea el perfil y añade al
 * historial solo si cambia la decisión efectiva, la última decisión, la vigencia o la versión
 * de política.
 *
 * @param personId - UUID del titular de la decisión y de la fila bloqueada.
 * @param granted - Indica si se autoriza la difusión. Una negativa se guarda sin vencimiento.
 * @param options - Origen, instante de decisión y vigencia opcionales. El origen predeterminado
 *   es portal.
 * @param db - Conexión opcional para leer y escribir en una transacción.
 * @returns Estado e historial actualizados, o null si el titular no existe o su UUID es
 *   inválido.
 */
export async function setDisseminationDecision(
  personId: string,
  granted: boolean,
  options: SetDisseminationOptions = {},
  db?: AppDb,
): Promise<DisseminationStatus | null> {
  if (!isUuid(personId)) return null;
  const database = await resolveDb(db);
  const now = options.now ?? new Date();
  const nextValidUntil = granted ? (options.validUntil ?? null) : null;
  const source = options.source?.trim().slice(0, 40) || "portal";

  return database.transaction(async (tx) => {
    const [profile] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, personId))
      .for("update");
    if (!profile) return null;

    const current = await readDisseminationStatus(tx, personId, now);
    const latest = current.history[0];

    const sameValidity =
      (latest?.validUntil?.getTime() ?? null) ===
      (nextValidUntil?.getTime() ?? null);

    if (
      latest &&
      current.granted === granted &&
      latest.granted === granted &&
      latest.policyVersion === DISSEMINATION_POLICY_VERSION &&
      sameValidity
    ) {
      return current;
    }

    await tx.insert(talentDisseminationDecisions).values({
      personId,
      purpose: DISSEMINATION_PURPOSE,
      granted,
      policyVersion: DISSEMINATION_POLICY_VERSION,
      source,
      validUntil: nextValidUntil,
      decidedAt: now,
    });

    return readDisseminationStatus(tx, personId, now);
  });
}
