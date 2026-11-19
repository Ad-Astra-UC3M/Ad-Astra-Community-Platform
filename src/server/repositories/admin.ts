import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getDb, type AppDb, type AppDbOrTx } from "../../db/client";
import {
  ACCOUNT_STATUSES,
  CAPABILITY_CODES,
  OPPORTUNITY_TYPES,
  PARTICIPATION_STATUSES,
  PUBLISH_STATUSES,
  accountCapabilities,
  activities,
  activityImages,
  adminAuditLogs,
  deletionRequests,
  opportunities,
  participationEvents,
  participations,
  profiles,
  shifts,
  talentDisseminationDecisions,
  talentProfiles,
  type AccountStatus,
  type AttendanceMethod,
  type CapabilityCode,
  type DeletionStatus,
  type OpportunityRow,
  type OpportunityType,
  type ParticipationEventType,
  type ParticipationStatus,
  type PublishStatus,
  type TalentExperience,
  type TalentLanguage,
  type TalentLink,
} from "../../db/schema";
import {
  DISSEMINATION_PURPOSE,
  normalizeTagList,
  type TalentExperienceItem,
} from "./profile";

export {
  ACCOUNT_STATUSES,
  CAPABILITY_CODES,
  OPPORTUNITY_TYPES,
  PARTICIPATION_STATUSES,
  PUBLISH_STATUSES,
  type AccountStatus,
  type AttendanceMethod,
  type CapabilityCode,
  type DeletionStatus,
  type OpportunityType,
  type ParticipationEventType,
  type ParticipationStatus,
  type PublishStatus,
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const AUDIT_EVENT_TYPES: readonly ParticipationEventType[] = [
  "door_registered",
  "attendance_qr",
  "attendance_manual",
  "attendance_corrected",
  "cancelled",
  "changed",
];

const reasonSchema = z.string().trim().min(1).max(500);
const resolutionNoteSchema = z.string().trim().min(1).max(2000);
const capabilitySchema = z.enum(CAPABILITY_CODES);
const accountStatusSchema = z.enum(ACCOUNT_STATUSES);
const publishStatusSchema = z.enum(PUBLISH_STATUSES);
const opportunityTypeSchema = z.enum(OPPORTUNITY_TYPES);
const participationStatusSchema = z.enum(PARTICIPATION_STATUSES);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShiftDetail {
  id: string;
  name: string;
  activityId: string;
  activitySlug: string;
  activityTitle: string;
  activityStatus: PublishStatus;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  locationOverride: string | null;
  reservedCount: number;
  attendedCount: number;
  available: number | null;
}

export interface ShiftAttendeeDetail {
  participationId: string;
  personId: string;
  name: string;
  email: string;
  status: ParticipationStatus;
  reservedAt: Date;
  attendedAt: Date | null;
  attendanceMethod: AttendanceMethod | null;
  source: string;
}

export interface DoorAccountCandidate {
  id: string;
  name: string;
  email: string;
  degree: string;
  course: string;
  alreadyInShift: boolean;
}

export type DoorRegistrationResult =
  | {
      ok: true;
      participationId: string;
      status: "booked";
      personId: string;
      personName: string;
      shiftId: string;
    }
  | { ok: false; error: "duplicate"; existing: true }
  | {
      ok: false;
      error:
        | "missing_reason"
        | "missing_actor"
        | "missing_account"
        | "account_deactivated"
        | "missing_shift"
        | "activity_not_published"
        | "shift_ended"
        | "full";
    };

export type AttendanceAdjustmentResult =
  | {
      ok: true;
      participationId: string;
      previousStatus: ParticipationStatus;
      newStatus: ParticipationStatus;
    }
  | {
      ok: false;
      error:
        | "missing_reason"
        | "missing_actor"
        | "invalid_status"
        | "missing_reservation"
        | "account_deactivated"
        | "already_attended"
        | "unchanged";
    };

export interface AttendanceAuditEntry {
  id: string;
  participationId: string;
  shiftId: string;
  fromShiftId: string | null;
  personId: string;
  personName: string;
  eventType: ParticipationEventType;
  previousStatus: ParticipationStatus | null;
  newStatus: ParticipationStatus | null;
  reason: string | null;
  actorProfileId: string;
  actorName: string;
  createdAt: Date;
}

export interface AdminActivityImage {
  id: string;
  imageUrl: string;
  imageAlt: string;
  position: number;
}

export interface AdminActivityImageInput {
  imageUrl: string;
  imageAlt: string;
  position?: number;
}

export interface AdminShiftInput {
  name?: string;
  startsAt: Date | number;
  endsAt: Date | number;
  capacity?: number | null;
  locationOverride?: string | null;
}

export interface CreateAdminActivityInput {
  slug?: string;
  title: string;
  description: string;
  location: string;
  externalRegistrationUrl?: string | null;
  status?: PublishStatus;
  startsAt?: Date | number;
  endsAt?: Date | number;
  capacity?: number | null;
  locationOverride?: string | null;
  shifts?: AdminShiftInput[];
  images?: AdminActivityImageInput[];
}

export interface AdminActivityShift {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  locationOverride: string | null;
  reservedCount: number;
  attendedCount: number;
  available: number | null;
}

export interface AdminActivity {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  externalRegistrationUrl: string | null;
  status: PublishStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  shifts: AdminActivityShift[];
  images: AdminActivityImage[];
}

export type CreateAdminActivityResult =
  | { ok: true; activity: AdminActivity }
  | {
      ok: false;
      error:
        | "missing_actor"
        | "missing_fields"
        | "invalid_status"
        | "invalid_slug"
        | "duplicate_slug"
        | "invalid_external_url"
        | "no_valid_shifts"
        | "invalid_schedule"
        | "invalid_capacity"
        | "invalid_image_url"
        | "missing_image_alt"
        | "invalid_image_position";
    };

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

export interface AdminShiftMetric {
  shiftId: string;
  activityId: string;
  activityTitle: string;
  activityStatus: PublishStatus;
  shiftName: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  reservedCount: number;
  attendedCount: number;
}

export interface AdminMetrics {
  totalAccounts: number;
  activeAccounts: number;
  deactivatedAccounts: number;
  pendingDeletionRequests: number;
  shifts: AdminShiftMetric[];
}

export interface AccountSearchFilters {
  query?: string;
  degree?: string;
  course?: string;
  status?: AccountStatus | "";
  hasParticipation?: boolean | "yes" | "no" | "";
}

export interface AdminAccountSummary {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  degree: string;
  academicLevel: string | null;
  languageModality: string | null;
  course: string;
  status: AccountStatus;
  capabilities: CapabilityCode[];
  reservationCount: number;
  attendedCount: number;
  emailVerifiedAt: Date | null;
  deactivatedAt: Date | null;
}

export interface AdminAccountDetail {
  id: string;
  name: string;
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
  deactivatedAt: Date | null;
  capabilities: CapabilityCode[];
  reservations: Array<{
    participationId: string;
    shiftId: string;
    shiftName: string;
    activityId: string;
    activityTitle: string;
    startsAt: Date;
    endsAt: Date;
    status: ParticipationStatus;
    reservedAt: Date;
    attendedAt: Date | null;
  }>;
  capabilityAudit: Array<{
    id: string;
    capability: CapabilityCode;
    action: "granted" | "revoked";
    actorProfileId: string | null;
    actorName: string;
    createdAt: Date;
  }>;
  deletionRequests: Array<{
    id: string;
    status: DeletionStatus;
    createdAt: Date;
    resolvedAt: Date | null;
  }>;
}

export type SetProfileCapabilityResult =
  | {
      ok: true;
      changed: boolean;
      capability: CapabilityCode;
      enabled: boolean;
    }
  | {
      ok: false;
      error: "invalid_capability" | "missing_profile" | "missing_actor";
    };

export type SetProfileStatusResult =
  | {
      ok: true;
      changed: boolean;
      profileId: string;
      status: AccountStatus;
    }
  | {
      ok: false;
      error: "invalid_status" | "missing_profile" | "missing_actor";
    };

export interface AdminDeletionRequest {
  id: string;
  personId: string;
  personName: string;
  personEmail: string;
  personStatus: AccountStatus;
  status: DeletionStatus;
  reason: string;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export type ResolveDeletionRequestResult =
  | { ok: true; request: AdminDeletionRequest }
  | {
      ok: false;
      error:
        | "invalid_status"
        | "missing_actor"
        | "missing_resolution_note"
        | "invalid_date"
        | "missing"
        | "already_resolved";
    };

export interface TalentSearchFilters {
  query?: string;
  tags?: string[];
  now?: Date;
}

export interface TalentProfileSummary {
  personId: string;
  name: string;
  email: string;
  degree: string;
  course: string;
  status: AccountStatus;
  university: string;
  expectedGraduationYear: number | null;
  headline: string;
  skills: string[];
  tools: string[];
  interests: string[];
  sectors: string[];
  opportunityTypes: string[];
  languages: TalentLanguage[];
  disseminationGranted: boolean;
  linksCount: number;
  updatedAt: Date;
}

export interface TalentAdminDetail extends TalentProfileSummary {
  experiences: TalentExperienceItem[];
  links: TalentLink[];
  disseminationDecidedAt: Date | null;
  disseminationValidUntil: Date | null;
  disseminationPolicyVersion: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

async function resolveDb(db?: AppDb): Promise<AppDb> {
  return db ?? getDb();
}

function formatName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function toValidDate(value: Date | number | undefined | null): Date | null {
  if (value === undefined || value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

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

function parseOptionalHttpsUrl(
  value: string | null | undefined,
): { valid: true; url: string | null } | { valid: false } {
  const trimmed = cleanOptionalText(value);
  if (!trimmed) return { valid: true, url: null };
  return isValidHttpsUrl(trimmed)
    ? { valid: true, url: trimmed }
    : { valid: false };
}

function parseOptionalEmail(
  value: string | null | undefined,
): { valid: true; email: string | null } | { valid: false } {
  const trimmed = cleanOptionalText(value)?.toLowerCase() ?? null;
  if (!trimmed) return { valid: true, email: null };
  if (trimmed.length > 254) return { valid: false };
  const parsed = z.string().email().safeParse(trimmed);
  return parsed.success ? { valid: true, email: trimmed } : { valid: false };
}

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

function normalizeExplicitSlug(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized.length > 100 || !SLUG_REGEX.test(normalized)) {
    return null;
  }
  return normalized;
}

function mapExperienceFromDb(item: TalentExperience): TalentExperienceItem {
  return {
    kind: item.kind,
    title: item.title,
    organization: item.organization ?? null,
    description: item.description ?? null,
    isFeatured: item.is_featured,
    sortOrder: item.sort_order,
  };
}

function mapOpportunityRow(row: OpportunityRow): AdminOpportunity {
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

async function profileExists(
  db: AppDbOrTx,
  profileId: string,
): Promise<boolean> {
  if (!isUuid(profileId)) return false;
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  return Boolean(row);
}

async function readLatestDisseminationMap(
  db: AppDbOrTx,
  personIds: string[],
  now: Date,
): Promise<
  Map<
    string,
    {
      granted: boolean;
      decidedAt: Date | null;
      validUntil: Date | null;
      policyVersion: string | null;
    }
  >
> {
  const result = new Map<
    string,
    {
      granted: boolean;
      decidedAt: Date | null;
      validUntil: Date | null;
      policyVersion: string | null;
    }
  >();

  if (personIds.length === 0) return result;

  const rows = await db
    .select()
    .from(talentDisseminationDecisions)
    .where(
      and(
        inArray(talentDisseminationDecisions.personId, personIds),
        eq(talentDisseminationDecisions.purpose, DISSEMINATION_PURPOSE),
      ),
    )
    .orderBy(
      desc(talentDisseminationDecisions.decidedAt),
      desc(talentDisseminationDecisions.id),
    );

  for (const row of rows) {
    if (result.has(row.personId)) continue;
    const expired = Boolean(
      row.validUntil !== null && row.validUntil.getTime() <= now.getTime(),
    );
    result.set(row.personId, {
      granted: row.granted && !expired,
      decidedAt: row.decidedAt,
      validUntil: row.validUntil ?? null,
      policyVersion: row.policyVersion,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// 1. Puerta, validación manual y rectificaciones (RF-14, CA-10)
// ---------------------------------------------------------------------------

export async function isAccountDeactivated(
  profileId: string,
  db?: AppDb,
): Promise<boolean> {
  if (!isUuid(profileId)) return false;
  const database = await resolveDb(db);
  const [row] = await database
    .select({ status: profiles.status })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  return row?.status === "deactivated";
}

export async function listShiftSummaries(db?: AppDb): Promise<ShiftDetail[]> {
  const database = await resolveDb(db);
  const rows = await database
    .select({
      id: shifts.id,
      name: shifts.name,
      activityId: shifts.activityId,
      activitySlug: activities.slug,
      activityTitle: activities.title,
      activityStatus: activities.status,
      startsAt: shifts.startsAt,
      endsAt: shifts.endsAt,
      capacity: shifts.capacity,
      locationOverride: shifts.locationOverride,
      reservedCount: sql<number>`COUNT(${participations.id})::int`,
      attendedCount: sql<number>`COUNT(${participations.id}) FILTER (WHERE ${participations.status} = 'attended')::int`,
    })
    .from(shifts)
    .innerJoin(activities, eq(activities.id, shifts.activityId))
    .leftJoin(participations, eq(participations.shiftId, shifts.id))
    .groupBy(shifts.id, activities.id)
    .orderBy(asc(shifts.startsAt), asc(shifts.id));

  return rows.map((row) => ({
    ...row,
    available:
      row.capacity === null
        ? null
        : Math.max(0, row.capacity - row.reservedCount),
  }));
}

export async function getShiftDetail(
  shiftId: string,
  db?: AppDb,
): Promise<ShiftDetail | null> {
  if (!isUuid(shiftId)) return null;
  const database = await resolveDb(db);
  const [row] = await database
    .select({
      id: shifts.id,
      name: shifts.name,
      activityId: shifts.activityId,
      activitySlug: activities.slug,
      activityTitle: activities.title,
      activityStatus: activities.status,
      startsAt: shifts.startsAt,
      endsAt: shifts.endsAt,
      capacity: shifts.capacity,
      locationOverride: shifts.locationOverride,
      reservedCount: sql<number>`COUNT(${participations.id})::int`,
      attendedCount: sql<number>`COUNT(${participations.id}) FILTER (WHERE ${participations.status} = 'attended')::int`,
    })
    .from(shifts)
    .innerJoin(activities, eq(activities.id, shifts.activityId))
    .leftJoin(participations, eq(participations.shiftId, shifts.id))
    .where(eq(shifts.id, shiftId))
    .groupBy(shifts.id, activities.id);

  if (!row) return null;
  return {
    ...row,
    available:
      row.capacity === null
        ? null
        : Math.max(0, row.capacity - row.reservedCount),
  };
}

export async function listShiftAttendeesDetailed(
  shiftId: string,
  query = "",
  db?: AppDb,
): Promise<ShiftAttendeeDetail[]> {
  if (!isUuid(shiftId)) return [];
  const database = await resolveDb(db);

  const rows = await database
    .select({
      participationId: participations.id,
      personId: participations.personId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      status: participations.status,
      reservedAt: participations.reservedAt,
      attendedAt: participations.attendedAt,
      attendanceMethod: participations.attendanceMethod,
      source: participations.source,
    })
    .from(participations)
    .innerJoin(profiles, eq(profiles.id, participations.personId))
    .where(eq(participations.shiftId, shiftId))
    .orderBy(asc(profiles.firstName), asc(profiles.lastName), asc(profiles.id));

  const needle = query.trim().toLowerCase();
  return rows
    .map((row): ShiftAttendeeDetail => ({
      participationId: row.participationId,
      personId: row.personId,
      name: formatName(row.firstName, row.lastName),
      email: row.email,
      status: row.status,
      reservedAt: row.reservedAt,
      attendedAt: row.attendedAt ?? null,
      attendanceMethod: row.attendanceMethod ?? null,
      source: row.source,
    }))
    .filter((entry) => {
      if (!needle) return true;
      return (
        entry.name.toLowerCase().includes(needle) ||
        entry.email.toLowerCase().includes(needle) ||
        entry.personId.toLowerCase().includes(needle)
      );
    });
}

export async function listActiveAccountsForDoor(
  shiftId: string,
  query = "",
  db?: AppDb,
): Promise<DoorAccountCandidate[]> {
  if (!isUuid(shiftId)) return [];
  const database = await resolveDb(db);

  const rows = await database
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      degree: profiles.degree,
      course: profiles.course,
      participationId: participations.id,
    })
    .from(profiles)
    .leftJoin(
      participations,
      and(
        eq(participations.personId, profiles.id),
        eq(participations.shiftId, shiftId),
      ),
    )
    .where(
      and(
        eq(profiles.status, "active"),
        sql`${profiles.emailVerifiedAt} IS NOT NULL`,
      ),
    )
    .orderBy(asc(profiles.firstName), asc(profiles.lastName), asc(profiles.id));

  const needle = query.trim().toLowerCase();
  return rows
    .map((row): DoorAccountCandidate => ({
      id: row.id,
      name: formatName(row.firstName, row.lastName),
      email: row.email,
      degree: row.degree,
      course: row.course,
      alreadyInShift: row.participationId !== null,
    }))
    .filter((entry) => {
      if (!needle) return true;
      return (
        entry.name.toLowerCase().includes(needle) ||
        entry.email.toLowerCase().includes(needle) ||
        entry.degree.toLowerCase().includes(needle)
      );
    });
}

export async function registerAtDoor(
  shiftId: string,
  targetPersonId: string,
  actorProfileId: string,
  reason: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<DoorRegistrationResult> {
  const parsedReason = reasonSchema.safeParse(reason);
  if (!parsedReason.success) {
    return { ok: false, error: "missing_reason" };
  }
  if (!isUuid(shiftId)) return { ok: false, error: "missing_shift" };
  if (!isUuid(targetPersonId)) return { ok: false, error: "missing_account" };
  if (!isUuid(actorProfileId)) return { ok: false, error: "missing_actor" };

  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    // Lock shift row first per spec §1.3.6 to serialize seat allocation
    const [shift] = await tx
      .select()
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .for("update");

    if (!shift) return { ok: false, error: "missing_shift" };

    const [target] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.id, targetPersonId))
      .limit(1);

    if (!target || !target.emailVerifiedAt) {
      return { ok: false, error: "missing_account" };
    }
    if (target.status !== "active") {
      return { ok: false, error: "account_deactivated" };
    }

    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    const [activity] = await tx
      .select({ status: activities.status })
      .from(activities)
      .where(eq(activities.id, shift.activityId))
      .limit(1);

    if (!activity || activity.status !== "published") {
      return { ok: false, error: "activity_not_published" };
    }

    if (shift.endsAt.getTime() <= now.getTime()) {
      return { ok: false, error: "shift_ended" };
    }

    const [existing] = await tx
      .select({ id: participations.id })
      .from(participations)
      .where(
        and(
          eq(participations.shiftId, shiftId),
          eq(participations.personId, targetPersonId),
        ),
      )
      .limit(1);

    if (existing) {
      return { ok: false, error: "duplicate", existing: true };
    }

    const [{ count }] = await tx
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(participations)
      .where(eq(participations.shiftId, shiftId));

    if (shift.capacity !== null && count >= shift.capacity) {
      return { ok: false, error: "full" };
    }

    const [inserted] = await tx
      .insert(participations)
      .values({
        personId: targetPersonId,
        shiftId,
        status: "booked",
        reservedAt: now,
        source: "door",
      })
      .returning({ id: participations.id });

    await tx.insert(participationEvents).values({
      participationId: inserted.id,
      personId: targetPersonId,
      actorProfileId,
      shiftId,
      eventType: "door_registered",
      reason: parsedReason.data,
      createdAt: now,
    });

    return {
      ok: true,
      participationId: inserted.id,
      status: "booked",
      personId: targetPersonId,
      personName: formatName(target.firstName, target.lastName),
      shiftId,
    };
  });
}

export async function manualConfirmAttendance(
  shiftId: string,
  personId: string,
  actorProfileId: string,
  reason: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<AttendanceAdjustmentResult> {
  const parsedReason = reasonSchema.safeParse(reason);
  if (!parsedReason.success) {
    return { ok: false, error: "missing_reason" };
  }
  if (!isUuid(shiftId) || !isUuid(personId)) {
    return { ok: false, error: "missing_reservation" };
  }
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }

  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [participation] = await tx
      .select()
      .from(participations)
      .where(
        and(
          eq(participations.shiftId, shiftId),
          eq(participations.personId, personId),
        ),
      )
      .for("update");

    if (!participation) {
      return { ok: false, error: "missing_reservation" };
    }

    const [target] = await tx
      .select({ status: profiles.status })
      .from(profiles)
      .where(eq(profiles.id, personId))
      .limit(1);

    if (!target || target.status !== "active") {
      return { ok: false, error: "account_deactivated" };
    }

    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    if (participation.status === "attended") {
      return { ok: false, error: "already_attended" };
    }

    await tx
      .update(participations)
      .set({
        status: "attended",
        attendedAt: now,
        validatedBy: actorProfileId,
        attendanceMethod: "manual",
      })
      .where(eq(participations.id, participation.id));

    await tx.insert(participationEvents).values({
      participationId: participation.id,
      personId,
      actorProfileId,
      shiftId,
      eventType: "attendance_manual",
      reason: parsedReason.data,
      createdAt: now,
    });

    return {
      ok: true,
      participationId: participation.id,
      previousStatus: "booked",
      newStatus: "attended",
    };
  });
}

export async function correctAttendance(
  shiftId: string,
  personId: string,
  targetStatus: ParticipationStatus,
  actorProfileId: string,
  reason: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<AttendanceAdjustmentResult> {
  const parsedStatus = participationStatusSchema.safeParse(targetStatus);
  if (!parsedStatus.success) {
    return { ok: false, error: "invalid_status" };
  }
  const parsedReason = reasonSchema.safeParse(reason);
  if (!parsedReason.success) {
    return { ok: false, error: "missing_reason" };
  }
  if (!isUuid(shiftId) || !isUuid(personId)) {
    return { ok: false, error: "missing_reservation" };
  }
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }

  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [participation] = await tx
      .select()
      .from(participations)
      .where(
        and(
          eq(participations.shiftId, shiftId),
          eq(participations.personId, personId),
        ),
      )
      .for("update");

    if (!participation) {
      return { ok: false, error: "missing_reservation" };
    }

    if (parsedStatus.data === "attended") {
      const [target] = await tx
        .select({ status: profiles.status })
        .from(profiles)
        .where(eq(profiles.id, personId))
        .limit(1);
      if (!target || target.status !== "active") {
        return { ok: false, error: "account_deactivated" };
      }
    }

    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    const previousStatus = participation.status;
    if (previousStatus === parsedStatus.data) {
      return { ok: false, error: "unchanged" };
    }

    if (parsedStatus.data === "attended") {
      await tx
        .update(participations)
        .set({
          status: "attended",
          attendedAt: now,
          validatedBy: actorProfileId,
          attendanceMethod: "manual",
        })
        .where(eq(participations.id, participation.id));
    } else {
      await tx
        .update(participations)
        .set({
          status: "booked",
          attendedAt: null,
          validatedBy: null,
          attendanceMethod: null,
        })
        .where(eq(participations.id, participation.id));
    }

    await tx.insert(participationEvents).values({
      participationId: participation.id,
      personId,
      actorProfileId,
      shiftId,
      eventType: "attendance_corrected",
      previousStatus,
      newStatus: parsedStatus.data,
      reason: parsedReason.data,
      createdAt: now,
    });

    return {
      ok: true,
      participationId: participation.id,
      previousStatus,
      newStatus: parsedStatus.data,
    };
  });
}

export async function listAttendanceAudit(
  shiftId: string,
  db?: AppDb,
): Promise<AttendanceAuditEntry[]> {
  if (!isUuid(shiftId)) return [];
  const database = await resolveDb(db);
  const personProfile = alias(profiles, "person_profile");
  const actorProfile = alias(profiles, "actor_profile");

  const rows = await database
    .select({
      id: participationEvents.id,
      participationId: participationEvents.participationId,
      shiftId: participationEvents.shiftId,
      fromShiftId: participationEvents.fromShiftId,
      personId: participationEvents.personId,
      personFirstName: personProfile.firstName,
      personLastName: personProfile.lastName,
      eventType: participationEvents.eventType,
      previousStatus: participationEvents.previousStatus,
      newStatus: participationEvents.newStatus,
      reason: participationEvents.reason,
      actorProfileId: participationEvents.actorProfileId,
      actorFirstName: actorProfile.firstName,
      actorLastName: actorProfile.lastName,
      createdAt: participationEvents.createdAt,
    })
    .from(participationEvents)
    .innerJoin(
      personProfile,
      eq(personProfile.id, participationEvents.personId),
    )
    .innerJoin(
      actorProfile,
      eq(actorProfile.id, participationEvents.actorProfileId),
    )
    .where(
      and(
        eq(participationEvents.shiftId, shiftId),
        inArray(participationEvents.eventType, [...AUDIT_EVENT_TYPES]),
      ),
    )
    .orderBy(
      asc(participationEvents.createdAt),
      asc(participationEvents.id),
    );

  return rows.map((row) => ({
    id: row.id,
    participationId: row.participationId,
    shiftId: row.shiftId,
    fromShiftId: row.fromShiftId ?? null,
    personId: row.personId,
    personName: formatName(row.personFirstName, row.personLastName),
    eventType: row.eventType,
    previousStatus: row.previousStatus ?? null,
    newStatus: row.newStatus ?? null,
    reason: row.reason ?? null,
    actorProfileId: row.actorProfileId,
    actorName: formatName(row.actorFirstName, row.actorLastName),
    createdAt: row.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// 2. Actividades y turnos (RF-09, RF-15, CA-06)
// ---------------------------------------------------------------------------

async function readAdminActivityShifts(
  db: AppDbOrTx,
  activityIds: string[],
): Promise<Map<string, AdminActivityShift[]>> {
  const byActivity = new Map<string, AdminActivityShift[]>();
  if (activityIds.length === 0) return byActivity;

  const rows = await db
    .select({
      id: shifts.id,
      activityId: shifts.activityId,
      name: shifts.name,
      startsAt: shifts.startsAt,
      endsAt: shifts.endsAt,
      capacity: shifts.capacity,
      locationOverride: shifts.locationOverride,
      reservedCount: sql<number>`COUNT(${participations.id})::int`,
      attendedCount: sql<number>`COUNT(${participations.id}) FILTER (WHERE ${participations.status} = 'attended')::int`,
    })
    .from(shifts)
    .leftJoin(participations, eq(participations.shiftId, shifts.id))
    .where(inArray(shifts.activityId, activityIds))
    .groupBy(shifts.id)
    .orderBy(asc(shifts.startsAt), asc(shifts.id));

  for (const row of rows) {
    const list = byActivity.get(row.activityId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      capacity: row.capacity,
      locationOverride: row.locationOverride ?? null,
      reservedCount: row.reservedCount,
      attendedCount: row.attendedCount,
      available:
        row.capacity === null
          ? null
          : Math.max(0, row.capacity - row.reservedCount),
    });
    byActivity.set(row.activityId, list);
  }

  return byActivity;
}

async function readAdminActivityImages(
  db: AppDbOrTx,
  activityIds: string[],
): Promise<Map<string, AdminActivityImage[]>> {
  const byActivity = new Map<string, AdminActivityImage[]>();
  if (activityIds.length === 0) return byActivity;

  const rows = await db
    .select()
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

export async function listAdminActivities(
  db?: AppDb,
): Promise<AdminActivity[]> {
  const database = await resolveDb(db);
  const rows = await database
    .select()
    .from(activities)
    .orderBy(
      sql`CASE ${activities.status} WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END`,
      asc(activities.title),
      asc(activities.id),
    );

  const ids = rows.map((row) => row.id);
  const [shiftsByActivity, imagesByActivity] = await Promise.all([
    readAdminActivityShifts(database, ids),
    readAdminActivityImages(database, ids),
  ]);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    location: row.location,
    externalRegistrationUrl: row.externalRegistrationUrl ?? null,
    status: row.status,
    publishedAt: row.publishedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    shifts: shiftsByActivity.get(row.id) ?? [],
    images: imagesByActivity.get(row.id) ?? [],
  }));
}

export async function createAdminActivity(
  input: CreateAdminActivityInput,
  actorProfileId: string,
  db?: AppDb,
): Promise<CreateAdminActivityResult> {
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }

  const title = input.title?.trim() ?? "";
  const description = input.description?.trim() ?? "";
  const location = input.location?.trim() ?? "";
  if (
    !title ||
    title.length > 160 ||
    !description ||
    !location ||
    location.length > 200
  ) {
    return { ok: false, error: "missing_fields" };
  }

  const parsedStatus = publishStatusSchema.safeParse(
    input.status ?? "published",
  );
  if (!parsedStatus.success) {
    return { ok: false, error: "invalid_status" };
  }
  const status = parsedStatus.data;

  const externalUrl = parseOptionalHttpsUrl(input.externalRegistrationUrl);
  if (!externalUrl.valid) {
    return { ok: false, error: "invalid_external_url" };
  }

  const slug =
    input.slug !== undefined
      ? normalizeExplicitSlug(input.slug)
      : generateSlug(title);
  if (!slug) {
    return { ok: false, error: "invalid_slug" };
  }

  const rawShifts: AdminShiftInput[] =
    input.shifts !== undefined
      ? input.shifts
      : [
          {
            name: "normal",
            startsAt: input.startsAt ?? Number.NaN,
            endsAt: input.endsAt ?? Number.NaN,
            capacity: input.capacity === undefined ? 0 : input.capacity,
            locationOverride: input.locationOverride,
          },
        ];

  if (status === "published" && rawShifts.length === 0) {
    return { ok: false, error: "no_valid_shifts" };
  }

  const normalizedShifts: Array<{
    name: string;
    startsAt: Date;
    endsAt: Date;
    capacity: number | null;
    locationOverride: string | null;
  }> = [];

  for (const shift of rawShifts) {
    const startsAt = toValidDate(shift.startsAt);
    const endsAt = toValidDate(shift.endsAt);
    if (!startsAt || !endsAt || endsAt.getTime() <= startsAt.getTime()) {
      return { ok: false, error: "invalid_schedule" };
    }
    const capacity = shift.capacity === undefined ? null : shift.capacity;
    if (
      capacity !== null &&
      (!Number.isInteger(capacity) || capacity <= 0)
    ) {
      return { ok: false, error: "invalid_capacity" };
    }
    normalizedShifts.push({
      name: (shift.name?.trim() || "normal").slice(0, 100),
      startsAt,
      endsAt,
      capacity,
      locationOverride: cleanOptionalText(shift.locationOverride, 200),
    });
  }

  const normalizedImages: Array<{
    imageUrl: string;
    imageAlt: string;
    position: number;
  }> = [];
  const usedPositions = new Set<number>();

  for (let index = 0; index < (input.images ?? []).length; index++) {
    const item = input.images![index];
    const imageUrl = item.imageUrl?.trim() ?? "";
    const imageAlt = item.imageAlt?.trim() ?? "";
    const position = item.position ?? index + 1;
    if (!isValidHttpsUrl(imageUrl)) {
      return { ok: false, error: "invalid_image_url" };
    }
    if (!imageAlt || imageAlt.length > 240) {
      return { ok: false, error: "missing_image_alt" };
    }
    if (
      !Number.isInteger(position) ||
      position < 1 ||
      usedPositions.has(position)
    ) {
      return { ok: false, error: "invalid_image_position" };
    }
    usedPositions.add(position);
    normalizedImages.push({ imageUrl, imageAlt, position });
  }

  const database = await resolveDb(db);
  const now = new Date();

  return database.transaction(async (tx) => {
    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    const [existingSlug] = await tx
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.slug, slug))
      .limit(1);
    if (existingSlug) {
      return { ok: false, error: "duplicate_slug" };
    }

    const [insertedActivity] = await tx
      .insert(activities)
      .values({
        slug,
        title,
        description,
        location,
        externalRegistrationUrl: externalUrl.url,
        status,
        createdBy: actorProfileId,
        publishedAt: status === "published" ? now : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (normalizedShifts.length > 0) {
      await tx.insert(shifts).values(
        normalizedShifts.map((shift) => ({
          activityId: insertedActivity.id,
          name: shift.name,
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
          capacity: shift.capacity,
          locationOverride: shift.locationOverride,
        })),
      );
    }

    if (normalizedImages.length > 0) {
      await tx.insert(activityImages).values(
        normalizedImages.map((img) => ({
          activityId: insertedActivity.id,
          imageUrl: img.imageUrl,
          imageAlt: img.imageAlt,
          position: img.position,
        })),
      );
    }

    await tx.insert(adminAuditLogs).values({
      actorProfileId,
      targetType: "activity",
      targetId: insertedActivity.id,
      action: "activity_created",
      result: "success",
      metadata: {
        slug,
        status,
        shiftCount: normalizedShifts.length,
        imageCount: normalizedImages.length,
      },
    });

    const [shiftsMap, imagesMap] = await Promise.all([
      readAdminActivityShifts(tx, [insertedActivity.id]),
      readAdminActivityImages(tx, [insertedActivity.id]),
    ]);

    return {
      ok: true,
      activity: {
        id: insertedActivity.id,
        slug: insertedActivity.slug,
        title: insertedActivity.title,
        description: insertedActivity.description,
        location: insertedActivity.location,
        externalRegistrationUrl:
          insertedActivity.externalRegistrationUrl ?? null,
        status: insertedActivity.status,
        publishedAt: insertedActivity.publishedAt ?? null,
        createdAt: insertedActivity.createdAt,
        updatedAt: insertedActivity.updatedAt,
        shifts: shiftsMap.get(insertedActivity.id) ?? [],
        images: imagesMap.get(insertedActivity.id) ?? [],
      },
    };
  });
}

export async function addActivityShift(
  activityId: string,
  input: AdminShiftInput,
  db?: AppDb,
): Promise<
  | { ok: true; shift: AdminActivityShift }
  | {
      ok: false;
      error: "missing_activity" | "invalid_schedule" | "invalid_capacity";
    }
> {
  if (!isUuid(activityId)) {
    return { ok: false, error: "missing_activity" };
  }

  const startsAt = toValidDate(input.startsAt);
  const endsAt = toValidDate(input.endsAt);
  if (!startsAt || !endsAt || endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "invalid_schedule" };
  }

  const capacity = input.capacity === undefined ? null : input.capacity;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
    return { ok: false, error: "invalid_capacity" };
  }

  const name = (input.name?.trim() || "normal").slice(0, 100);
  const locationOverride = cleanOptionalText(input.locationOverride, 200);
  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [activity] = await tx
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.id, activityId))
      .limit(1);
    if (!activity) return { ok: false, error: "missing_activity" };

    const [inserted] = await tx
      .insert(shifts)
      .values({
        activityId,
        name,
        startsAt,
        endsAt,
        capacity,
        locationOverride,
      })
      .returning();

    return {
      ok: true,
      shift: {
        id: inserted.id,
        name: inserted.name,
        startsAt: inserted.startsAt,
        endsAt: inserted.endsAt,
        capacity: inserted.capacity,
        locationOverride: inserted.locationOverride ?? null,
        reservedCount: 0,
        attendedCount: 0,
        available: inserted.capacity,
      },
    };
  });
}

export async function updateShiftCapacity(
  shiftId: string,
  newCapacity: number | null,
  db?: AppDb,
): Promise<
  | {
      ok: true;
      shiftId: string;
      capacity: number | null;
      reservedCount: number;
    }
  | { ok: false; error: "invalid_capacity" | "missing_shift" }
  | { ok: false; error: "below_reserved"; reservedCount: number }
> {
  if (
    newCapacity !== null &&
    (!Number.isInteger(newCapacity) || newCapacity <= 0)
  ) {
    return { ok: false, error: "invalid_capacity" };
  }
  if (!isUuid(shiftId)) {
    return { ok: false, error: "missing_shift" };
  }

  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [shift] = await tx
      .select({ id: shifts.id })
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .for("update");
    if (!shift) return { ok: false, error: "missing_shift" };

    const [{ reservedCount }] = await tx
      .select({ reservedCount: sql<number>`COUNT(*)::int` })
      .from(participations)
      .where(eq(participations.shiftId, shiftId));

    if (newCapacity !== null && newCapacity < reservedCount) {
      return { ok: false, error: "below_reserved", reservedCount };
    }

    await tx
      .update(shifts)
      .set({ capacity: newCapacity })
      .where(eq(shifts.id, shiftId));

    return { ok: true, shiftId, capacity: newCapacity, reservedCount };
  });
}

export async function deleteShift(
  shiftId: string,
  db?: AppDb,
): Promise<
  | { ok: true; shiftId: string }
  | { ok: false; error: "missing_shift" }
  | {
      ok: false;
      error: "has_participants";
      reservedCount: number;
      eventCount: number;
    }
> {
  if (!isUuid(shiftId)) {
    return { ok: false, error: "missing_shift" };
  }

  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [shift] = await tx
      .select({ id: shifts.id })
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .for("update");
    if (!shift) return { ok: false, error: "missing_shift" };

    const [{ reservedCount }] = await tx
      .select({ reservedCount: sql<number>`COUNT(*)::int` })
      .from(participations)
      .where(eq(participations.shiftId, shiftId));

    const [{ eventCount }] = await tx
      .select({ eventCount: sql<number>`COUNT(*)::int` })
      .from(participationEvents)
      .where(
        or(
          eq(participationEvents.shiftId, shiftId),
          eq(participationEvents.fromShiftId, shiftId),
        ),
      );

    if (reservedCount > 0 || eventCount > 0) {
      return {
        ok: false,
        error: "has_participants",
        reservedCount,
        eventCount,
      };
    }

    await tx.delete(shifts).where(eq(shifts.id, shiftId));
    return { ok: true, shiftId };
  });
}

export async function setActivityStatus(
  activityId: string,
  status: PublishStatus,
  actorProfileId: string,
  db?: AppDb,
): Promise<
  | { ok: true; activityId: string; status: PublishStatus }
  | {
      ok: false;
      error:
        | "invalid_status"
        | "missing_actor"
        | "missing_activity"
        | "no_valid_shifts";
    }
> {
  const parsedStatus = publishStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { ok: false, error: "invalid_status" };
  }
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }
  if (!isUuid(activityId)) {
    return { ok: false, error: "missing_activity" };
  }

  const database = await resolveDb(db);
  const now = new Date();

  return database.transaction(async (tx) => {
    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    const [activity] = await tx
      .select()
      .from(activities)
      .where(eq(activities.id, activityId))
      .for("update");
    if (!activity) return { ok: false, error: "missing_activity" };

    if (parsedStatus.data === "published") {
      const [{ count }] = await tx
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(shifts)
        .where(
          and(
            eq(shifts.activityId, activityId),
            sql`${shifts.endsAt} > ${shifts.startsAt}`,
            sql`(${shifts.capacity} IS NULL OR ${shifts.capacity} > 0)`,
          ),
        );
      if (count === 0) {
        return { ok: false, error: "no_valid_shifts" };
      }
    }

    await tx
      .update(activities)
      .set({
        status: parsedStatus.data,
        publishedAt:
          parsedStatus.data === "published"
            ? (activity.publishedAt ?? now)
            : activity.publishedAt,
        updatedAt: now,
      })
      .where(eq(activities.id, activityId));

    await tx.insert(adminAuditLogs).values({
      actorProfileId,
      targetType: "activity",
      targetId: activityId,
      action: "activity_status_updated",
      result: "success",
      metadata: {
        previousStatus: activity.status,
        status: parsedStatus.data,
      },
    });

    return { ok: true, activityId, status: parsedStatus.data };
  });
}

// ---------------------------------------------------------------------------
// 3. Oportunidades (RF-08, RF-15, CA-05)
// ---------------------------------------------------------------------------

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
  return rows.map(mapOpportunityRow);
}

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

    const [existingSlug] = await tx
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(eq(opportunities.slug, slug))
      .limit(1);
    if (existingSlug) {
      return { ok: false, error: "duplicate_slug" };
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
      .returning();

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

    return { ok: true, opportunity: mapOpportunityRow(inserted) };
  });
}

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

    return { ok: true, opportunity: mapOpportunityRow(updated) };
  });
}

// ---------------------------------------------------------------------------
// 4. Cuentas, capacidades, métricas y supresiones (RF-01, RF-15, RF-16)
// ---------------------------------------------------------------------------

export async function getAdminMetrics(db?: AppDb): Promise<AdminMetrics> {
  const database = await resolveDb(db);

  const [accountCounts] = await database
    .select({
      totalAccounts: sql<number>`COUNT(*)::int`,
      activeAccounts: sql<number>`COUNT(*) FILTER (WHERE ${profiles.status} = 'active')::int`,
      deactivatedAccounts: sql<number>`COUNT(*) FILTER (WHERE ${profiles.status} = 'deactivated')::int`,
    })
    .from(profiles);

  const [pendingDeletions] = await database
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(deletionRequests)
    .where(inArray(deletionRequests.status, ["pending", "in_review"]));

  const shiftRows = await database
    .select({
      shiftId: shifts.id,
      activityId: shifts.activityId,
      activityTitle: activities.title,
      activityStatus: activities.status,
      shiftName: shifts.name,
      startsAt: shifts.startsAt,
      endsAt: shifts.endsAt,
      capacity: shifts.capacity,
      reservedCount: sql<number>`COUNT(${participations.id})::int`,
      attendedCount: sql<number>`COUNT(${participations.id}) FILTER (WHERE ${participations.status} = 'attended')::int`,
    })
    .from(shifts)
    .innerJoin(activities, eq(activities.id, shifts.activityId))
    .leftJoin(participations, eq(participations.shiftId, shifts.id))
    .groupBy(shifts.id, activities.id)
    .orderBy(asc(shifts.startsAt), asc(shifts.id));

  return {
    totalAccounts: accountCounts?.totalAccounts ?? 0,
    activeAccounts: accountCounts?.activeAccounts ?? 0,
    deactivatedAccounts: accountCounts?.deactivatedAccounts ?? 0,
    pendingDeletionRequests: pendingDeletions?.count ?? 0,
    shifts: shiftRows,
  };
}

export async function searchAccounts(
  filters: AccountSearchFilters = {},
  db?: AppDb,
): Promise<AdminAccountSummary[]> {
  const database = await resolveDb(db);

  const rows = await database
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      degree: profiles.degree,
      academicLevel: profiles.academicLevel,
      languageModality: profiles.languageModality,
      course: profiles.course,
      status: profiles.status,
      emailVerifiedAt: profiles.emailVerifiedAt,
      deactivatedAt: profiles.deactivatedAt,
      reservationCount: sql<number>`COUNT(${participations.id})::int`,
      attendedCount: sql<number>`COUNT(${participations.id}) FILTER (WHERE ${participations.status} = 'attended')::int`,
    })
    .from(profiles)
    .leftJoin(participations, eq(participations.personId, profiles.id))
    .groupBy(profiles.id)
    .orderBy(asc(profiles.firstName), asc(profiles.lastName), asc(profiles.id));

  const profileIds = rows.map((row) => row.id);
  const capRows =
    profileIds.length > 0
      ? await database
          .select({
            profileId: accountCapabilities.profileId,
            capabilityCode: accountCapabilities.capabilityCode,
          })
          .from(accountCapabilities)
          .where(inArray(accountCapabilities.profileId, profileIds))
          .orderBy(asc(accountCapabilities.capabilityCode))
      : [];

  const capsByProfile = new Map<string, CapabilityCode[]>();
  for (const cap of capRows) {
    const list = capsByProfile.get(cap.profileId) ?? [];
    list.push(cap.capabilityCode);
    capsByProfile.set(cap.profileId, list);
  }

  const queryNeedle = (filters.query ?? "").trim().toLowerCase();
  const degreeNeedle = (filters.degree ?? "").trim().toLowerCase();
  const courseNeedle = (filters.course ?? "").trim().toLowerCase();
  const statusFilter =
    filters.status === "active" || filters.status === "deactivated"
      ? filters.status
      : "";
  const participationFilter =
    filters.hasParticipation === true || filters.hasParticipation === "yes"
      ? "yes"
      : filters.hasParticipation === false || filters.hasParticipation === "no"
        ? "no"
        : "";

  return rows
    .map((row): AdminAccountSummary => ({
      id: row.id,
      name: formatName(row.firstName, row.lastName),
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      degree: row.degree,
      academicLevel: row.academicLevel ?? null,
      languageModality: row.languageModality ?? null,
      course: row.course,
      status: row.status,
      capabilities: capsByProfile.get(row.id) ?? [],
      reservationCount: row.reservationCount,
      attendedCount: row.attendedCount,
      emailVerifiedAt: row.emailVerifiedAt ?? null,
      deactivatedAt: row.deactivatedAt ?? null,
    }))
    .filter((account) => {
      if (queryNeedle) {
        const matchesQuery =
          account.name.toLowerCase().includes(queryNeedle) ||
          account.email.toLowerCase().includes(queryNeedle);
        if (!matchesQuery) return false;
      }
      if (
        degreeNeedle &&
        !account.degree.toLowerCase().includes(degreeNeedle)
      ) {
        return false;
      }
      if (
        courseNeedle &&
        !account.course.toLowerCase().includes(courseNeedle)
      ) {
        return false;
      }
      if (statusFilter && account.status !== statusFilter) return false;
      if (participationFilter === "yes" && account.reservationCount === 0) {
        return false;
      }
      if (participationFilter === "no" && account.reservationCount > 0) {
        return false;
      }
      return true;
    });
}

export async function getAccountAdminDetail(
  profileId: string,
  db?: AppDb,
): Promise<AdminAccountDetail | null> {
  if (!isUuid(profileId)) return null;
  const database = await resolveDb(db);

  const [profile] = await database
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profile) return null;

  const actorProfile = alias(profiles, "audit_actor_profile");

  const [capRows, reservationRows, auditRows, deletionRows] = await Promise.all(
    [
      database
        .select({ capabilityCode: accountCapabilities.capabilityCode })
        .from(accountCapabilities)
        .where(eq(accountCapabilities.profileId, profileId))
        .orderBy(asc(accountCapabilities.capabilityCode)),
      database
        .select({
          participationId: participations.id,
          shiftId: participations.shiftId,
          shiftName: shifts.name,
          activityId: activities.id,
          activityTitle: activities.title,
          startsAt: shifts.startsAt,
          endsAt: shifts.endsAt,
          status: participations.status,
          reservedAt: participations.reservedAt,
          attendedAt: participations.attendedAt,
        })
        .from(participations)
        .innerJoin(shifts, eq(shifts.id, participations.shiftId))
        .innerJoin(activities, eq(activities.id, shifts.activityId))
        .where(eq(participations.personId, profileId))
        .orderBy(desc(shifts.startsAt), asc(shifts.id)),
      database
        .select({
          id: adminAuditLogs.id,
          action: adminAuditLogs.action,
          metadata: adminAuditLogs.metadata,
          actorProfileId: adminAuditLogs.actorProfileId,
          actorFirstName: actorProfile.firstName,
          actorLastName: actorProfile.lastName,
          createdAt: adminAuditLogs.createdAt,
        })
        .from(adminAuditLogs)
        .leftJoin(
          actorProfile,
          eq(actorProfile.id, adminAuditLogs.actorProfileId),
        )
        .where(
          and(
            eq(adminAuditLogs.targetType, "profile"),
            eq(adminAuditLogs.targetId, profileId),
            inArray(adminAuditLogs.action, [
              "capability_granted",
              "capability_revoked",
            ]),
          ),
        )
        .orderBy(desc(adminAuditLogs.createdAt), desc(adminAuditLogs.id)),
      database
        .select({
          id: deletionRequests.id,
          status: deletionRequests.status,
          createdAt: deletionRequests.createdAt,
          resolvedAt: deletionRequests.resolvedAt,
        })
        .from(deletionRequests)
        .where(eq(deletionRequests.personId, profileId))
        .orderBy(desc(deletionRequests.createdAt), desc(deletionRequests.id)),
    ],
  );

  const capabilityAudit: AdminAccountDetail["capabilityAudit"] = [];
  for (const entry of auditRows) {
    const rawCap = entry.metadata?.capability;
    const parsedCap = capabilitySchema.safeParse(rawCap);
    if (!parsedCap.success) continue;
    const actorName =
      entry.actorFirstName || entry.actorLastName
        ? formatName(entry.actorFirstName ?? "", entry.actorLastName ?? "")
        : entry.actorProfileId === null
          ? "Bootstrap"
          : entry.actorProfileId;

    capabilityAudit.push({
      id: entry.id,
      capability: parsedCap.data,
      action:
        entry.action === "capability_granted" ? "granted" : "revoked",
      actorProfileId: entry.actorProfileId ?? null,
      actorName,
      createdAt: entry.createdAt,
    });
  }

  return {
    id: profile.id,
    name: formatName(profile.firstName, profile.lastName),
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    degree: profile.degree,
    academicLevel: profile.academicLevel ?? null,
    languageModality: profile.languageModality ?? null,
    course: profile.course,
    status: profile.status,
    privacyVersion: profile.privacyVersion,
    privacyAcceptedAt: profile.privacyAcceptedAt,
    emailVerifiedAt: profile.emailVerifiedAt ?? null,
    deactivatedAt: profile.deactivatedAt ?? null,
    capabilities: capRows.map((row) => row.capabilityCode),
    reservations: reservationRows.map((row) => ({
      ...row,
      attendedAt: row.attendedAt ?? null,
    })),
    capabilityAudit,
    deletionRequests: deletionRows.map((row) => ({
      ...row,
      resolvedAt: row.resolvedAt ?? null,
    })),
  };
}

export async function setProfileCapability(
  targetProfileId: string,
  capability: CapabilityCode,
  enabled: boolean,
  actorProfileId: string,
  db?: AppDb,
): Promise<SetProfileCapabilityResult> {
  const parsedCapability = capabilitySchema.safeParse(capability);
  if (!parsedCapability.success) {
    return { ok: false, error: "invalid_capability" };
  }
  if (!isUuid(targetProfileId)) {
    return { ok: false, error: "missing_profile" };
  }
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }

  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, targetProfileId))
      .for("update");
    if (!target) return { ok: false, error: "missing_profile" };

    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    if (enabled) {
      const inserted = await tx
        .insert(accountCapabilities)
        .values({
          profileId: targetProfileId,
          capabilityCode: parsedCapability.data,
          grantedBy: actorProfileId,
        })
        .onConflictDoNothing({
          target: [
            accountCapabilities.profileId,
            accountCapabilities.capabilityCode,
          ],
        })
        .returning({ capabilityCode: accountCapabilities.capabilityCode });

      if (inserted.length === 0) {
        return {
          ok: true,
          changed: false,
          capability: parsedCapability.data,
          enabled: true,
        };
      }

      await tx.insert(adminAuditLogs).values({
        actorProfileId,
        targetType: "profile",
        targetId: targetProfileId,
        action: "capability_granted",
        result: "success",
        metadata: { capability: parsedCapability.data },
      });

      return {
        ok: true,
        changed: true,
        capability: parsedCapability.data,
        enabled: true,
      };
    }

    const deleted = await tx
      .delete(accountCapabilities)
      .where(
        and(
          eq(accountCapabilities.profileId, targetProfileId),
          eq(accountCapabilities.capabilityCode, parsedCapability.data),
        ),
      )
      .returning({ capabilityCode: accountCapabilities.capabilityCode });

    if (deleted.length === 0) {
      return {
        ok: true,
        changed: false,
        capability: parsedCapability.data,
        enabled: false,
      };
    }

    await tx.insert(adminAuditLogs).values({
      actorProfileId,
      targetType: "profile",
      targetId: targetProfileId,
      action: "capability_revoked",
      result: "success",
      metadata: { capability: parsedCapability.data },
    });

    return {
      ok: true,
      changed: true,
      capability: parsedCapability.data,
      enabled: false,
    };
  });
}

export async function setProfileStatus(
  targetProfileId: string,
  status: AccountStatus,
  actorProfileId: string,
  onDeactivateAuthUser?: (authUserId: string) => Promise<void>,
  db?: AppDb,
): Promise<SetProfileStatusResult> {
  const parsedStatus = accountStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { ok: false, error: "invalid_status" };
  }
  if (!isUuid(targetProfileId)) {
    return { ok: false, error: "missing_profile" };
  }
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }

  const database = await resolveDb(db);
  const now = new Date();

  const txResult = await database.transaction(async (tx) => {
    const [target] = await tx
      .select({
        id: profiles.id,
        status: profiles.status,
        authUserId: profiles.authUserId,
      })
      .from(profiles)
      .where(eq(profiles.id, targetProfileId))
      .for("update");
    if (!target) {
      return { ok: false as const, error: "missing_profile" as const };
    }

    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false as const, error: "missing_actor" as const };
    }

    if (target.status === parsedStatus.data) {
      return {
        ok: true as const,
        changed: false,
        profileId: target.id,
        status: parsedStatus.data,
        authUserId: target.authUserId,
      };
    }

    await tx
      .update(profiles)
      .set({
        status: parsedStatus.data,
        deactivatedAt: parsedStatus.data === "deactivated" ? now : null,
        updatedAt: now,
      })
      .where(eq(profiles.id, targetProfileId));

    await tx.insert(adminAuditLogs).values({
      actorProfileId,
      targetType: "profile",
      targetId: targetProfileId,
      action:
        parsedStatus.data === "deactivated"
          ? "account_deactivated"
          : "account_reactivated",
      result: "success",
      metadata: {
        previousStatus: target.status,
        status: parsedStatus.data,
      },
    });

    return {
      ok: true as const,
      changed: true,
      profileId: target.id,
      status: parsedStatus.data,
      authUserId: target.authUserId,
    };
  });

  if (!txResult.ok) {
    return txResult;
  }

  if (
    txResult.changed &&
    txResult.status === "deactivated" &&
    txResult.authUserId &&
    onDeactivateAuthUser
  ) {
    await onDeactivateAuthUser(txResult.authUserId);
  }

  return {
    ok: true,
    changed: txResult.changed,
    profileId: txResult.profileId,
    status: txResult.status,
  };
}

async function queryDeletionRequests(
  db: AppDbOrTx,
  requestId?: string,
): Promise<AdminDeletionRequest[]> {
  const personProfile = alias(profiles, "deletion_person");
  const resolverProfile = alias(profiles, "deletion_resolver");

  const baseQuery = db
    .select({
      id: deletionRequests.id,
      personId: deletionRequests.personId,
      personFirstName: personProfile.firstName,
      personLastName: personProfile.lastName,
      personEmail: personProfile.email,
      personStatus: personProfile.status,
      status: deletionRequests.status,
      reason: deletionRequests.reason,
      resolutionNote: deletionRequests.resolutionNote,
      resolvedBy: deletionRequests.resolvedBy,
      resolverFirstName: resolverProfile.firstName,
      resolverLastName: resolverProfile.lastName,
      createdAt: deletionRequests.createdAt,
      resolvedAt: deletionRequests.resolvedAt,
    })
    .from(deletionRequests)
    .innerJoin(personProfile, eq(personProfile.id, deletionRequests.personId))
    .leftJoin(
      resolverProfile,
      eq(resolverProfile.id, deletionRequests.resolvedBy),
    );

  const rows = requestId
    ? await baseQuery.where(eq(deletionRequests.id, requestId)).limit(1)
    : await baseQuery.orderBy(
        sql`CASE ${deletionRequests.status} WHEN 'pending' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END`,
        desc(deletionRequests.createdAt),
        desc(deletionRequests.id),
      );

  return rows.map((row) => ({
    id: row.id,
    personId: row.personId,
    personName: formatName(row.personFirstName, row.personLastName),
    personEmail: row.personEmail,
    personStatus: row.personStatus,
    status: row.status,
    reason: row.reason ?? "",
    resolutionNote: row.resolutionNote ?? null,
    resolvedBy: row.resolvedBy ?? null,
    resolvedByName:
      row.resolverFirstName || row.resolverLastName
        ? formatName(row.resolverFirstName ?? "", row.resolverLastName ?? "")
        : row.resolvedBy ?? null,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? null,
  }));
}

export async function listDeletionRequests(
  db?: AppDb,
): Promise<AdminDeletionRequest[]> {
  const database = await resolveDb(db);
  return queryDeletionRequests(database);
}

export async function getDeletionRequest(
  requestId: string,
  db?: AppDb,
): Promise<AdminDeletionRequest | null> {
  if (!isUuid(requestId)) return null;
  const database = await resolveDb(db);
  const [row] = await queryDeletionRequests(database, requestId);
  return row ?? null;
}

export async function resolveDeletionRequest(
  requestId: string,
  status: "in_review" | "resolved",
  resolutionNote: string,
  actorProfileId: string,
  now: Date = new Date(),
  db?: AppDb,
): Promise<ResolveDeletionRequestResult> {
  if (status !== "in_review" && status !== "resolved") {
    return { ok: false, error: "invalid_status" };
  }
  if (!isUuid(actorProfileId)) {
    return { ok: false, error: "missing_actor" };
  }
  if (!isUuid(requestId)) {
    return { ok: false, error: "missing" };
  }

  const trimmedNote = resolutionNote.trim();
  if (status === "resolved") {
    const parsedNote = resolutionNoteSchema.safeParse(trimmedNote);
    if (!parsedNote.success) {
      return { ok: false, error: "missing_resolution_note" };
    }
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      return { ok: false, error: "invalid_date" };
    }
  }

  const database = await resolveDb(db);

  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(deletionRequests)
      .where(eq(deletionRequests.id, requestId))
      .for("update");

    if (!existing) return { ok: false, error: "missing" };
    if (existing.status === "resolved") {
      return { ok: false, error: "already_resolved" };
    }

    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    if (status === "resolved") {
      await tx
        .update(deletionRequests)
        .set({
          status: "resolved",
          resolutionNote: trimmedNote,
          resolvedBy: actorProfileId,
          resolvedAt: now,
        })
        .where(eq(deletionRequests.id, requestId));

      await tx.insert(adminAuditLogs).values({
        actorProfileId,
        targetType: "deletion_request",
        targetId: requestId,
        action: "deletion_request_resolved",
        result: "success",
        metadata: {
          personId: existing.personId,
          previousStatus: existing.status,
          status: "resolved",
        },
      });
    } else {
      await tx
        .update(deletionRequests)
        .set({
          status: "in_review",
          resolutionNote: null,
          resolvedBy: null,
          resolvedAt: null,
        })
        .where(eq(deletionRequests.id, requestId));

      await tx.insert(adminAuditLogs).values({
        actorProfileId,
        targetType: "deletion_request",
        targetId: requestId,
        action: "deletion_request_in_review",
        result: "success",
        metadata: {
          personId: existing.personId,
          previousStatus: existing.status,
          status: "in_review",
          ...(trimmedNote ? { note: trimmedNote.slice(0, 500) } : {}),
        },
      });
    }

    const [updated] = await queryDeletionRequests(tx, requestId);
    return { ok: true, request: updated };
  });
}

// ---------------------------------------------------------------------------
// 5. Consulta de talento (RF-01, RF-06, CA-01, CA-04)
// ---------------------------------------------------------------------------

export async function searchTalentProfiles(
  filters: TalentSearchFilters = {},
  db?: AppDb,
): Promise<TalentProfileSummary[]> {
  const database = await resolveDb(db);
  const now = filters.now ?? new Date();
  const normalizedTags = normalizeTagList(filters.tags);

  const whereClause =
    normalizedTags.length > 0
      ? (() => {
          const pgTagArray = sql`ARRAY[${sql.join(
            normalizedTags.map((tag) => sql`${tag}`),
            sql`, `,
          )}]::text[]`;
          return or(
            sql`${talentProfiles.skills} && ${pgTagArray}`,
            sql`${talentProfiles.tools} && ${pgTagArray}`,
            sql`${talentProfiles.interests} && ${pgTagArray}`,
            sql`${talentProfiles.sectors} && ${pgTagArray}`,
            sql`${talentProfiles.opportunityTypes} && ${pgTagArray}`,
          );
        })()
      : undefined;

  const baseSelect = database
    .select({
      personId: talentProfiles.personId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      degree: profiles.degree,
      course: profiles.course,
      status: profiles.status,
      university: talentProfiles.university,
      expectedGraduationYear: talentProfiles.expectedGraduationYear,
      headline: talentProfiles.headline,
      skills: talentProfiles.skills,
      tools: talentProfiles.tools,
      interests: talentProfiles.interests,
      sectors: talentProfiles.sectors,
      opportunityTypes: talentProfiles.opportunityTypes,
      experiences: talentProfiles.experiences,
      languages: talentProfiles.languages,
      links: talentProfiles.links,
      updatedAt: talentProfiles.updatedAt,
    })
    .from(talentProfiles)
    .innerJoin(profiles, eq(profiles.id, talentProfiles.personId));

  const rows = whereClause
    ? await baseSelect
        .where(whereClause)
        .orderBy(
          desc(talentProfiles.updatedAt),
          asc(profiles.firstName),
          asc(profiles.lastName),
        )
    : await baseSelect.orderBy(
        desc(talentProfiles.updatedAt),
        asc(profiles.firstName),
        asc(profiles.lastName),
      );

  const disseminationMap = await readLatestDisseminationMap(
    database,
    rows.map((row) => row.personId),
    now,
  );

  const needle = (filters.query ?? "").trim().toLowerCase();

  return rows
    .map((row) => {
      const name = formatName(row.firstName, row.lastName);
      const dissemination = disseminationMap.get(row.personId);
      const summary: TalentProfileSummary = {
        personId: row.personId,
        name,
        email: row.email,
        degree: row.degree,
        course: row.course,
        status: row.status,
        university: row.university ?? "",
        expectedGraduationYear: row.expectedGraduationYear ?? null,
        headline: row.headline ?? "",
        skills: [...row.skills],
        tools: [...row.tools],
        interests: [...row.interests],
        sectors: [...row.sectors],
        opportunityTypes: [...row.opportunityTypes],
        languages: row.languages.map((entry) => ({ ...entry })),
        disseminationGranted: dissemination?.granted ?? false,
        linksCount: row.links.length,
        updatedAt: row.updatedAt,
      };

      const searchable = [
        name,
        row.email,
        row.degree,
        row.university ?? "",
        row.headline ?? "",
        ...row.skills,
        ...row.tools,
        ...row.interests,
        ...row.sectors,
        ...row.opportunityTypes,
        ...row.experiences.flatMap((exp) => [
          exp.title,
          exp.organization ?? "",
          exp.description ?? "",
        ]),
        ...row.languages.flatMap((lang) => [lang.language, lang.level]),
      ]
        .join(" ")
        .toLowerCase();

      return { summary, searchable };
    })
    .filter((entry) => !needle || entry.searchable.includes(needle))
    .map((entry) => entry.summary);
}

export async function getTalentAdminDetail(
  personId: string,
  db?: AppDb,
  now: Date = new Date(),
): Promise<TalentAdminDetail | null> {
  if (!isUuid(personId)) return null;
  const database = await resolveDb(db);

  const [row] = await database
    .select({
      personId: talentProfiles.personId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      degree: profiles.degree,
      course: profiles.course,
      status: profiles.status,
      university: talentProfiles.university,
      expectedGraduationYear: talentProfiles.expectedGraduationYear,
      headline: talentProfiles.headline,
      skills: talentProfiles.skills,
      tools: talentProfiles.tools,
      interests: talentProfiles.interests,
      sectors: talentProfiles.sectors,
      opportunityTypes: talentProfiles.opportunityTypes,
      experiences: talentProfiles.experiences,
      languages: talentProfiles.languages,
      links: talentProfiles.links,
      updatedAt: talentProfiles.updatedAt,
    })
    .from(talentProfiles)
    .innerJoin(profiles, eq(profiles.id, talentProfiles.personId))
    .where(eq(talentProfiles.personId, personId))
    .limit(1);

  if (!row) return null;

  const disseminationMap = await readLatestDisseminationMap(
    database,
    [personId],
    now,
  );
  const dissemination = disseminationMap.get(personId);

  return {
    personId: row.personId,
    name: formatName(row.firstName, row.lastName),
    email: row.email,
    degree: row.degree,
    course: row.course,
    status: row.status,
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
    linksCount: row.links.length,
    disseminationGranted: dissemination?.granted ?? false,
    disseminationDecidedAt: dissemination?.decidedAt ?? null,
    disseminationValidUntil: dissemination?.validUntil ?? null,
    disseminationPolicyVersion: dissemination?.policyVersion ?? null,
    updatedAt: row.updatedAt,
  };
}
