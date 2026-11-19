import { randomUUID } from "node:crypto";
import { type ActivityImage, listShifts } from "./activities";
import { db } from "./db";
import {
  type CreateOpportunityInput,
  type Opportunity,
  type OpportunityResult,
  type OpportunityStatus,
  createOpportunity,
  seedOpportunities,
  updateOpportunityStatus,
} from "./opportunities";
import "./profile";
import { type DeletionRequestStatus, type TalentLink } from "./profile";
import { type AccountStatus, type AdminCapability, SessionStore } from "./session-store";

export type { AccountStatus, AdminCapability };

export type ActivityStatus = "draft" | "published" | "archived";
export type AttendanceAuditAction = "door_registration" | "manual_confirm" | "correction";

export type DoorRegistrationResult =
  | { ok: true; status: "booked"; personId: string; personName: string; shiftId: string }
  | { ok: false; error: "duplicate"; existing: true }
  | {
      ok: false;
      error:
        | "missing_reason"
        | "missing_account"
        | "account_deactivated"
        | "missing_shift"
        | "activity_not_published"
        | "shift_ended"
        | "full";
    };

export type AttendanceAdjustmentResult =
  | { ok: true; previousStatus: "booked" | "attended"; newStatus: "booked" | "attended" }
  | {
      ok: false;
      error:
        | "missing_reason"
        | "invalid_status"
        | "missing_reservation"
        | "account_deactivated"
        | "already_attended"
        | "unchanged";
    };

export type AttendanceAuditEntry = {
  id: string;
  shiftId: string;
  personId: string;
  personName: string;
  action: AttendanceAuditAction;
  previousStatus: "booked" | "attended" | null;
  newStatus: "booked" | "attended";
  reason: string;
  actorId: string;
  actorName: string;
  createdAt: number;
};

export type ShiftDetail = {
  id: string;
  name: string;
  activityId: string;
  activityTitle: string;
  activityStatus: ActivityStatus;
  startsAt: number;
  endsAt: number;
  capacity: number;
  reservedCount: number;
  attendedCount: number;
  available: number;
};

export type ShiftAttendeeDetail = {
  personId: string;
  name: string;
  email: string | null;
  status: "booked" | "attended";
  reservedAt: number;
  attendedAt: number | null;
  attendanceMethod: string | null;
};

export type DoorAccountCandidate = {
  id: string;
  name: string;
  email: string;
  degree: string;
  course: string;
  alreadyInShift: boolean;
};

export type AdminShiftInput = {
  id?: string;
  name?: string;
  startsAt: number;
  endsAt: number;
  capacity: number;
};

export type AdminActivityImageInput = {
  imageUrl: string;
  imageAlt: string;
  position?: number;
};

export type CreateAdminActivityInput = {
  id?: string;
  title: string;
  description: string;
  location: string;
  status?: ActivityStatus;
  startsAt?: number;
  endsAt?: number;
  capacity?: number;
  shifts?: AdminShiftInput[];
  images?: AdminActivityImageInput[];
};

export type AdminActivityShift = {
  id: string;
  name: string;
  startsAt: number;
  endsAt: number;
  capacity: number;
  reservedCount: number;
  attendedCount: number;
  available: number;
};

export type AdminActivity = {
  id: string;
  title: string;
  description: string;
  location: string;
  status: ActivityStatus;
  shifts: AdminActivityShift[];
  images: ActivityImage[];
};

export type CreateAdminActivityResult =
  | { ok: true; activity: AdminActivity }
  | {
      ok: false;
      error:
        | "missing_fields"
        | "invalid_status"
        | "invalid_schedule"
        | "invalid_capacity"
        | "invalid_image_url"
        | "missing_image_alt"
        | "invalid_image_position"
        | "duplicate_id";
    };

export type AdminShiftMetric = {
  shiftId: string;
  activityId: string;
  activityTitle: string;
  activityStatus: ActivityStatus;
  shiftName: string;
  startsAt: number;
  endsAt: number;
  reservedCount: number;
  attendedCount: number;
  capacity: number;
};

export type AdminMetrics = {
  totalAccounts: number;
  activeAccounts: number;
  deactivatedAccounts: number;
  pendingDeletionRequests: number;
  shifts: AdminShiftMetric[];
};

export type AccountSearchFilters = {
  query?: string;
  degree?: string;
  course?: string;
  status?: AccountStatus | "";
  hasParticipation?: boolean | "yes" | "no" | "";
};

export type AdminAccountSummary = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "organizer";
  degree: string;
  course: string;
  status: AccountStatus;
  capabilities: AdminCapability[];
  reservationCount: number;
  attendedCount: number;
  verifiedAt: number | null;
};

export type AdminAccountDetail = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "organizer";
  degree: string;
  course: string;
  status: AccountStatus;
  privacyVersion: string | null;
  privacyAcceptedAt: number | null;
  verifiedAt: number | null;
  capabilities: AdminCapability[];
  reservations: Array<{
    shiftId: string;
    shiftName: string;
    activityId: string;
    activityTitle: string;
    startsAt: number;
    endsAt: number;
    status: "booked" | "attended";
    reservedAt: number;
    attendedAt: number | null;
  }>;
  capabilityAudit: Array<{
    id: string;
    capability: AdminCapability;
    action: "granted" | "revoked";
    actorId: string;
    actorName: string;
    createdAt: number;
  }>;
  deletionRequests: Array<{
    id: string;
    status: DeletionRequestStatus;
    createdAt: number;
    resolvedAt: number | null;
  }>;
};

export type AdminDeletionRequest = {
  id: string;
  accountId: string;
  accountName: string;
  accountEmail: string;
  accountStatus: AccountStatus;
  status: DeletionRequestStatus;
  reason: string;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  createdAt: number;
  resolvedAt: number | null;
};

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

export type TalentProfileSummary = {
  accountId: string;
  name: string;
  email: string;
  degree: string;
  course: string;
  status: AccountStatus;
  university: string;
  graduationYear: number | null;
  headline: string;
  skills: string[];
  tools: string[];
  interests: string[];
  sectors: string[];
  languages: string[];
  disseminationGranted: boolean;
  linksCount: number;
  updatedAt: number;
};

export type TalentAdminDetail = TalentProfileSummary & {
  experiencesSummary: string;
  featuredProject: string;
  links: TalentLink[];
  disseminationDecidedAt: number | null;
  disseminationPolicyVersion: string | null;
};

// Ensure demo_accounts, demo_account_capabilities, and demo_capability_audit exist.
const sessionStore = new SessionStore(db);

function hasColumn(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((row) => row.name === column);
}

if (!hasColumn("demo_activities", "status")) {
  db.exec(`
    ALTER TABLE demo_activities
    ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived'))
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS demo_attendance_audit (
    workspace_id TEXT NOT NULL,
    id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('door_registration', 'manual_confirm', 'correction')),
    previous_status TEXT,
    new_status TEXT NOT NULL CHECK (new_status IN ('booked', 'attended')),
    reason TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id, shift_id) REFERENCES demo_activity_shifts (workspace_id, id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS demo_attendance_audit_shift
    ON demo_attendance_audit (workspace_id, shift_id, created_at DESC);
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

function syntheticEmailFor(role: "student" | "organizer"): string {
  return role === "organizer" ? "organizacion.demo@uc3m.es" : "estudiante.demo@alumnos.uc3m.es";
}

function formatName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function isValidHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function isActivityStatus(value: string): value is ActivityStatus {
  return value === "draft" || value === "published" || value === "archived";
}

function readAccountCapabilities(workspaceId: string, accountId: string): AdminCapability[] {
  return sessionStore.getCapabilities(workspaceId, accountId);
}

// ---------------------------------------------------------------------------
// 1. Attendance at door, manual validation & corrections (RF-14, CA-09, CA-10)
// ---------------------------------------------------------------------------

export function isAccountDeactivated(workspaceId: string, accountId: string): boolean {
  const row = db.prepare(`
    SELECT status FROM demo_accounts WHERE workspace_id = ? AND id = ?
  `).get(workspaceId, accountId) as { status: AccountStatus } | undefined;
  return row?.status === "deactivated";
}

export function listShiftSummaries(workspaceId: string): ShiftDetail[] {
  listShifts(workspaceId);
  const rows = db.prepare(`
    SELECT
      shift.id,
      shift.name,
      shift.activity_id AS activityId,
      activity.title AS activityTitle,
      activity.status AS activityStatus,
      shift.starts_at AS startsAt,
      shift.ends_at AS endsAt,
      shift.capacity,
      COUNT(reservation.person_id) AS reservedCount,
      SUM(CASE WHEN reservation.attended_at IS NOT NULL THEN 1 ELSE 0 END) AS attendedCount
    FROM demo_activity_shifts AS shift
    JOIN demo_activities AS activity
      ON activity.workspace_id = shift.workspace_id AND activity.id = shift.activity_id
    LEFT JOIN demo_activity_reservations AS reservation
      ON reservation.workspace_id = shift.workspace_id AND reservation.shift_id = shift.id
    WHERE shift.workspace_id = ?
    GROUP BY shift.workspace_id, shift.id
    ORDER BY shift.starts_at, shift.id
  `).all(workspaceId) as Array<Omit<ShiftDetail, "available"> & { attendedCount: number | null }>;

  return rows.map((row) => ({
    ...row,
    attendedCount: row.attendedCount ?? 0,
    available: Math.max(0, row.capacity - row.reservedCount),
  }));
}

export function getShiftDetail(workspaceId: string, shiftId: string): ShiftDetail | null {
  listShifts(workspaceId);
  const row = db.prepare(`
    SELECT
      shift.id,
      shift.name,
      shift.activity_id AS activityId,
      activity.title AS activityTitle,
      activity.status AS activityStatus,
      shift.starts_at AS startsAt,
      shift.ends_at AS endsAt,
      shift.capacity,
      COUNT(reservation.person_id) AS reservedCount,
      SUM(CASE WHEN reservation.attended_at IS NOT NULL THEN 1 ELSE 0 END) AS attendedCount
    FROM demo_activity_shifts AS shift
    JOIN demo_activities AS activity
      ON activity.workspace_id = shift.workspace_id AND activity.id = shift.activity_id
    LEFT JOIN demo_activity_reservations AS reservation
      ON reservation.workspace_id = shift.workspace_id AND reservation.shift_id = shift.id
    WHERE shift.workspace_id = ? AND shift.id = ?
    GROUP BY shift.workspace_id, shift.id
  `).get(workspaceId, shiftId) as (Omit<ShiftDetail, "available"> & { attendedCount: number | null }) | undefined;

  if (!row) return null;
  const attendedCount = row.attendedCount ?? 0;
  return {
    ...row,
    attendedCount,
    available: Math.max(0, row.capacity - row.reservedCount),
  };
}

export function listShiftAttendeesDetailed(
  workspaceId: string,
  shiftId: string,
  query = "",
): ShiftAttendeeDetail[] {
  listShifts(workspaceId);
  const rows = db.prepare(`
    SELECT
      r.person_id AS personId,
      r.person_name AS name,
      a.email,
      a.role,
      r.reserved_at AS reservedAt,
      r.attended_at AS attendedAt,
      r.attendance_method AS attendanceMethod
    FROM demo_activity_reservations AS r
    LEFT JOIN demo_accounts AS a
      ON a.workspace_id = r.workspace_id AND a.id = r.person_id
    WHERE r.workspace_id = ? AND r.shift_id = ?
    ORDER BY r.person_name, r.person_id
  `).all(workspaceId, shiftId) as Array<{
    personId: string;
    name: string;
    email: string | null;
    role: "student" | "organizer" | null;
    reservedAt: number;
    attendedAt: number | null;
    attendanceMethod: string | null;
  }>;

  const needle = query.trim().toLowerCase();
  return rows
    .map((row): ShiftAttendeeDetail => ({
      personId: row.personId,
      name: row.name,
      email: row.email ?? (row.role ? syntheticEmailFor(row.role) : null),
      status: row.attendedAt === null ? "booked" : "attended",
      reservedAt: row.reservedAt,
      attendedAt: row.attendedAt,
      attendanceMethod: row.attendanceMethod,
    }))
    .filter((entry) => {
      if (!needle) return true;
      return (
        entry.name.toLowerCase().includes(needle) ||
        (entry.email?.toLowerCase().includes(needle) ?? false) ||
        entry.personId.toLowerCase().includes(needle)
      );
    });
}

export function listActiveAccountsForDoor(
  workspaceId: string,
  shiftId: string,
  query = "",
): DoorAccountCandidate[] {
  const rows = db.prepare(`
    SELECT
      a.id,
      a.first_name AS firstName,
      a.last_name AS lastName,
      a.email,
      a.role,
      a.degree,
      a.course,
      CASE WHEN r.person_id IS NOT NULL THEN 1 ELSE 0 END AS alreadyInShift
    FROM demo_accounts AS a
    LEFT JOIN demo_activity_reservations AS r
      ON r.workspace_id = a.workspace_id AND r.shift_id = ? AND r.person_id = a.id
    WHERE a.workspace_id = ? AND a.verified_at IS NOT NULL AND a.status = 'active'
    ORDER BY a.first_name, a.last_name, a.id
  `).all(shiftId, workspaceId) as Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    role: "student" | "organizer";
    degree: string | null;
    course: string | null;
    alreadyInShift: number;
  }>;

  const needle = query.trim().toLowerCase();
  return rows
    .map((row) => ({
      id: row.id,
      name: formatName(row.firstName, row.lastName),
      email: row.email ?? syntheticEmailFor(row.role),
      degree: row.degree ?? "",
      course: row.course ?? "",
      alreadyInShift: row.alreadyInShift === 1,
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

export function registerAtDoor(
  workspaceId: string,
  shiftId: string,
  targetAccountId: string,
  actorId: string,
  reason: string,
  now = Date.now(),
): DoorRegistrationResult {
  const trimmedReason = reason.trim();
  if (!trimmedReason || trimmedReason.length > 500) {
    return { ok: false, error: "missing_reason" };
  }

  return writeTransaction(() => {
    const account = db.prepare(`
      SELECT id, first_name AS firstName, last_name AS lastName, status, verified_at AS verifiedAt
      FROM demo_accounts
      WHERE workspace_id = ? AND id = ?
    `).get(workspaceId, targetAccountId) as {
      id: string;
      firstName: string;
      lastName: string;
      status: AccountStatus;
      verifiedAt: number | null;
    } | undefined;

    if (!account || account.verifiedAt === null) {
      return { ok: false, error: "missing_account" };
    }
    if (account.status !== "active") {
      return { ok: false, error: "account_deactivated" };
    }

    const shift = db.prepare(`
      SELECT
        shift.id,
        shift.ends_at AS endsAt,
        shift.capacity,
        activity.status AS activityStatus,
        COUNT(reservation.person_id) AS reservedCount,
        MAX(CASE WHEN reservation.person_id = ? THEN 1 ELSE 0 END) AS alreadyBooked
      FROM demo_activity_shifts AS shift
      JOIN demo_activities AS activity
        ON activity.workspace_id = shift.workspace_id AND activity.id = shift.activity_id
      LEFT JOIN demo_activity_reservations AS reservation
        ON reservation.workspace_id = shift.workspace_id AND reservation.shift_id = shift.id
      WHERE shift.workspace_id = ? AND shift.id = ?
      GROUP BY shift.workspace_id, shift.id
    `).get(targetAccountId, workspaceId, shiftId) as {
      id: string;
      endsAt: number;
      capacity: number;
      activityStatus: ActivityStatus;
      reservedCount: number;
      alreadyBooked: number;
    } | undefined;

    if (!shift) return { ok: false, error: "missing_shift" };
    if (shift.activityStatus !== "published") return { ok: false, error: "activity_not_published" };
    if (shift.endsAt <= now) return { ok: false, error: "shift_ended" };
    if (shift.alreadyBooked === 1) return { ok: false, error: "duplicate", existing: true };
    if (shift.capacity - shift.reservedCount <= 0) return { ok: false, error: "full" };

    const personName = formatName(account.firstName, account.lastName);
    db.prepare(`
      INSERT INTO demo_activity_reservations (workspace_id, shift_id, person_id, person_name, reserved_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(workspaceId, shiftId, targetAccountId, personName, now);

    db.prepare(`
      INSERT INTO demo_attendance_audit (
        workspace_id, id, shift_id, person_id, action, previous_status, new_status, reason, actor_id, created_at
      )
      VALUES (?, ?, ?, ?, 'door_registration', NULL, 'booked', ?, ?, ?)
    `).run(workspaceId, randomUUID(), shiftId, targetAccountId, trimmedReason, actorId, now);

    return { ok: true, status: "booked", personId: targetAccountId, personName, shiftId };
  });
}

export function manualConfirmAttendance(
  workspaceId: string,
  shiftId: string,
  personId: string,
  actorId: string,
  reason: string,
  now = Date.now(),
): AttendanceAdjustmentResult {
  const trimmedReason = reason.trim();
  if (!trimmedReason || trimmedReason.length > 500) {
    return { ok: false, error: "missing_reason" };
  }

  return writeTransaction(() => {
    const reservation = db.prepare(`
      SELECT attended_at AS attendedAt
      FROM demo_activity_reservations
      WHERE workspace_id = ? AND shift_id = ? AND person_id = ?
    `).get(workspaceId, shiftId, personId) as { attendedAt: number | null } | undefined;

    if (!reservation) return { ok: false, error: "missing_reservation" };
    if (isAccountDeactivated(workspaceId, personId)) {
      return { ok: false, error: "account_deactivated" };
    }
    if (reservation.attendedAt !== null) return { ok: false, error: "already_attended" };

    db.prepare(`
      UPDATE demo_activity_reservations
      SET attended_at = ?, attended_by = ?, attendance_method = NULL
      WHERE workspace_id = ? AND shift_id = ? AND person_id = ?
    `).run(now, actorId, workspaceId, shiftId, personId);

    db.prepare(`
      INSERT INTO demo_attendance_audit (
        workspace_id, id, shift_id, person_id, action, previous_status, new_status, reason, actor_id, created_at
      )
      VALUES (?, ?, ?, ?, 'manual_confirm', 'booked', 'attended', ?, ?, ?)
    `).run(workspaceId, randomUUID(), shiftId, personId, trimmedReason, actorId, now);

    return { ok: true, previousStatus: "booked", newStatus: "attended" };
  });
}

export function correctAttendance(
  workspaceId: string,
  shiftId: string,
  personId: string,
  targetStatus: "booked" | "attended",
  actorId: string,
  reason: string,
  now = Date.now(),
): AttendanceAdjustmentResult {
  if (targetStatus !== "booked" && targetStatus !== "attended") {
    return { ok: false, error: "invalid_status" };
  }
  const trimmedReason = reason.trim();
  if (!trimmedReason || trimmedReason.length > 500) {
    return { ok: false, error: "missing_reason" };
  }

  return writeTransaction(() => {
    const reservation = db.prepare(`
      SELECT attended_at AS attendedAt
      FROM demo_activity_reservations
      WHERE workspace_id = ? AND shift_id = ? AND person_id = ?
    `).get(workspaceId, shiftId, personId) as { attendedAt: number | null } | undefined;

    if (!reservation) return { ok: false, error: "missing_reservation" };
    if (targetStatus === "attended" && isAccountDeactivated(workspaceId, personId)) {
      return { ok: false, error: "account_deactivated" };
    }

    const previousStatus: "booked" | "attended" = reservation.attendedAt === null ? "booked" : "attended";
    if (previousStatus === targetStatus) return { ok: false, error: "unchanged" };

    if (targetStatus === "attended") {
      db.prepare(`
        UPDATE demo_activity_reservations
        SET attended_at = ?, attended_by = ?, attendance_method = NULL
        WHERE workspace_id = ? AND shift_id = ? AND person_id = ?
      `).run(now, actorId, workspaceId, shiftId, personId);
    } else {
      db.prepare(`
        UPDATE demo_activity_reservations
        SET attended_at = NULL, attended_by = NULL, attendance_method = NULL
        WHERE workspace_id = ? AND shift_id = ? AND person_id = ?
      `).run(workspaceId, shiftId, personId);
    }

    db.prepare(`
      INSERT INTO demo_attendance_audit (
        workspace_id, id, shift_id, person_id, action, previous_status, new_status, reason, actor_id, created_at
      )
      VALUES (?, ?, ?, ?, 'correction', ?, ?, ?, ?, ?)
    `).run(workspaceId, randomUUID(), shiftId, personId, previousStatus, targetStatus, trimmedReason, actorId, now);

    return { ok: true, previousStatus, newStatus: targetStatus };
  });
}

export function listAttendanceAudit(workspaceId: string, shiftId: string): AttendanceAuditEntry[] {
  const rows = db.prepare(`
    SELECT
      audit.id,
      audit.shift_id AS shiftId,
      audit.person_id AS personId,
      COALESCE(r.person_name, trim(target.first_name || ' ' || target.last_name), audit.person_id) AS personName,
      audit.action,
      audit.previous_status AS previousStatus,
      audit.new_status AS newStatus,
      audit.reason,
      audit.actor_id AS actorId,
      COALESCE(trim(actor.first_name || ' ' || actor.last_name), audit.actor_id) AS actorName,
      audit.created_at AS createdAt
    FROM demo_attendance_audit AS audit
    LEFT JOIN demo_activity_reservations AS r
      ON r.workspace_id = audit.workspace_id AND r.shift_id = audit.shift_id AND r.person_id = audit.person_id
    LEFT JOIN demo_accounts AS target
      ON target.workspace_id = audit.workspace_id AND target.id = audit.person_id
    LEFT JOIN demo_accounts AS actor
      ON actor.workspace_id = audit.workspace_id AND actor.id = audit.actor_id
    WHERE audit.workspace_id = ? AND audit.shift_id = ?
    ORDER BY audit.created_at DESC, audit.rowid DESC
  `).all(workspaceId, shiftId) as unknown as AttendanceAuditEntry[];

  return rows.map((row) => ({ ...row }));
}

// ---------------------------------------------------------------------------
// 2. Admin Activities Management (RF-09, RF-15, CA-06)
// ---------------------------------------------------------------------------

function readAdminActivityShifts(workspaceId: string, activityId: string): AdminActivityShift[] {
  const rows = db.prepare(`
    SELECT
      shift.id,
      shift.name,
      shift.starts_at AS startsAt,
      shift.ends_at AS endsAt,
      shift.capacity,
      COUNT(reservation.person_id) AS reservedCount,
      SUM(CASE WHEN reservation.attended_at IS NOT NULL THEN 1 ELSE 0 END) AS attendedCount
    FROM demo_activity_shifts AS shift
    LEFT JOIN demo_activity_reservations AS reservation
      ON reservation.workspace_id = shift.workspace_id AND reservation.shift_id = shift.id
    WHERE shift.workspace_id = ? AND shift.activity_id = ?
    GROUP BY shift.workspace_id, shift.id
    ORDER BY shift.starts_at, shift.id
  `).all(workspaceId, activityId) as Array<{
    id: string;
    name: string;
    startsAt: number;
    endsAt: number;
    capacity: number;
    reservedCount: number;
    attendedCount: number | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    capacity: row.capacity,
    reservedCount: row.reservedCount,
    attendedCount: row.attendedCount ?? 0,
    available: Math.max(0, row.capacity - row.reservedCount),
  }));
}

function readAdminActivityImages(workspaceId: string, activityId: string): ActivityImage[] {
  const rows = db.prepare(`
    SELECT image_url AS imageUrl, image_alt AS imageAlt, position
    FROM demo_activity_images
    WHERE workspace_id = ? AND activity_id = ?
    ORDER BY position ASC
  `).all(workspaceId, activityId) as unknown as ActivityImage[];
  return rows.map((row) => ({ ...row }));
}

export function listAdminActivities(workspaceId: string): AdminActivity[] {
  listShifts(workspaceId);
  const rows = db.prepare(`
    SELECT id, title, description, location, status
    FROM demo_activities
    WHERE workspace_id = ?
    ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, title, id
  `).all(workspaceId) as Array<{
    id: string;
    title: string;
    description: string;
    location: string;
    status: ActivityStatus;
  }>;

  return rows.map((row) => ({
    ...row,
    shifts: readAdminActivityShifts(workspaceId, row.id),
    images: readAdminActivityImages(workspaceId, row.id),
  }));
}

export function createAdminActivity(
  workspaceId: string,
  input: CreateAdminActivityInput,
  _actorId: string,
): CreateAdminActivityResult {
  const title = input.title.trim();
  const description = input.description.trim();
  const location = input.location.trim();
  if (!title || !description || !location) {
    return { ok: false, error: "missing_fields" };
  }

  const status = input.status ?? "published";
  if (!isActivityStatus(status)) {
    return { ok: false, error: "invalid_status" };
  }

  const rawShifts: AdminShiftInput[] =
    input.shifts && input.shifts.length > 0
      ? input.shifts
      : [
          {
            name: "normal",
            startsAt: input.startsAt ?? Number.NaN,
            endsAt: input.endsAt ?? Number.NaN,
            capacity: input.capacity ?? 0,
          },
        ];

  const shifts: Array<{ id: string; name: string; startsAt: number; endsAt: number; capacity: number }> = [];
  for (const shift of rawShifts) {
    const name = (shift.name ?? "").trim() || "normal";
    if (!Number.isFinite(shift.startsAt) || !Number.isFinite(shift.endsAt) || shift.endsAt <= shift.startsAt) {
      return { ok: false, error: "invalid_schedule" };
    }
    if (!Number.isInteger(shift.capacity) || shift.capacity <= 0) {
      return { ok: false, error: "invalid_capacity" };
    }
    shifts.push({
      id: shift.id?.trim() || randomUUID(),
      name,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      capacity: shift.capacity,
    });
  }

  const images: ActivityImage[] = [];
  const usedPositions = new Set<number>();
  for (let index = 0; index < (input.images ?? []).length; index++) {
    const item = input.images![index];
    const imageUrl = item.imageUrl.trim();
    const imageAlt = item.imageAlt.trim();
    const position = item.position ?? index + 1;
    if (!isValidHttpsUrl(imageUrl)) return { ok: false, error: "invalid_image_url" };
    if (!imageAlt) return { ok: false, error: "missing_image_alt" };
    if (!Number.isInteger(position) || position <= 0 || usedPositions.has(position)) {
      return { ok: false, error: "invalid_image_position" };
    }
    usedPositions.add(position);
    images.push({ imageUrl, imageAlt, position });
  }

  const activityId = input.id?.trim() || randomUUID();

  return writeTransaction(() => {
    const existing = db.prepare(
      "SELECT 1 FROM demo_activities WHERE workspace_id = ? AND id = ?",
    ).get(workspaceId, activityId);
    if (existing) return { ok: false, error: "duplicate_id" };

    db.prepare(`
      INSERT INTO demo_activities (workspace_id, id, title, description, location, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(workspaceId, activityId, title, description, location, status);

    const insertShift = db.prepare(`
      INSERT INTO demo_activity_shifts (workspace_id, id, activity_id, name, starts_at, ends_at, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const shift of shifts) {
      insertShift.run(workspaceId, shift.id, activityId, shift.name, shift.startsAt, shift.endsAt, shift.capacity);
    }

    const insertImage = db.prepare(`
      INSERT INTO demo_activity_images (workspace_id, activity_id, image_url, image_alt, position)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const image of images) {
      insertImage.run(workspaceId, activityId, image.imageUrl, image.imageAlt, image.position);
    }

    return {
      ok: true,
      activity: {
        id: activityId,
        title,
        description,
        location,
        status,
        shifts: readAdminActivityShifts(workspaceId, activityId),
        images: readAdminActivityImages(workspaceId, activityId),
      },
    };
  });
}

export function addActivityShift(
  workspaceId: string,
  activityId: string,
  input: AdminShiftInput,
):
  | { ok: true; shift: AdminActivityShift }
  | { ok: false; error: "missing_activity" | "invalid_schedule" | "invalid_capacity" } {
  if (!Number.isFinite(input.startsAt) || !Number.isFinite(input.endsAt) || input.endsAt <= input.startsAt) {
    return { ok: false, error: "invalid_schedule" };
  }
  if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
    return { ok: false, error: "invalid_capacity" };
  }
  const name = (input.name ?? "").trim() || "normal";
  const shiftId = input.id?.trim() || randomUUID();

  return writeTransaction(() => {
    const exists = db.prepare(
      "SELECT 1 FROM demo_activities WHERE workspace_id = ? AND id = ?",
    ).get(workspaceId, activityId);
    if (!exists) return { ok: false, error: "missing_activity" };

    db.prepare(`
      INSERT INTO demo_activity_shifts (workspace_id, id, activity_id, name, starts_at, ends_at, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(workspaceId, shiftId, activityId, name, input.startsAt, input.endsAt, input.capacity);

    return {
      ok: true,
      shift: {
        id: shiftId,
        name,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        capacity: input.capacity,
        reservedCount: 0,
        attendedCount: 0,
        available: input.capacity,
      },
    };
  });
}

export function updateShiftCapacity(
  workspaceId: string,
  shiftId: string,
  newCapacity: number,
):
  | { ok: true; shiftId: string; capacity: number; reservedCount: number }
  | { ok: false; error: "invalid_capacity" | "missing_shift" }
  | { ok: false; error: "below_reserved"; reservedCount: number } {
  if (!Number.isInteger(newCapacity) || newCapacity <= 0) {
    return { ok: false, error: "invalid_capacity" };
  }

  return writeTransaction(() => {
    const row = db.prepare(`
      SELECT shift.id, COUNT(reservation.person_id) AS reservedCount
      FROM demo_activity_shifts AS shift
      LEFT JOIN demo_activity_reservations AS reservation
        ON reservation.workspace_id = shift.workspace_id AND reservation.shift_id = shift.id
      WHERE shift.workspace_id = ? AND shift.id = ?
      GROUP BY shift.workspace_id, shift.id
    `).get(workspaceId, shiftId) as { id: string; reservedCount: number } | undefined;

    if (!row) return { ok: false, error: "missing_shift" };
    if (newCapacity < row.reservedCount) {
      return { ok: false, error: "below_reserved", reservedCount: row.reservedCount };
    }

    db.prepare(`
      UPDATE demo_activity_shifts
      SET capacity = ?
      WHERE workspace_id = ? AND id = ?
    `).run(newCapacity, workspaceId, shiftId);

    return { ok: true, shiftId, capacity: newCapacity, reservedCount: row.reservedCount };
  });
}

export function deleteShift(
  workspaceId: string,
  shiftId: string,
):
  | { ok: true; shiftId: string }
  | { ok: false; error: "missing_shift" }
  | { ok: false; error: "has_participants"; reservedCount: number } {
  return writeTransaction(() => {
    const row = db.prepare(`
      SELECT shift.id, COUNT(reservation.person_id) AS reservedCount
      FROM demo_activity_shifts AS shift
      LEFT JOIN demo_activity_reservations AS reservation
        ON reservation.workspace_id = shift.workspace_id AND reservation.shift_id = shift.id
      WHERE shift.workspace_id = ? AND shift.id = ?
      GROUP BY shift.workspace_id, shift.id
    `).get(workspaceId, shiftId) as { id: string; reservedCount: number } | undefined;

    if (!row) return { ok: false, error: "missing_shift" };
    if (row.reservedCount > 0) {
      return { ok: false, error: "has_participants", reservedCount: row.reservedCount };
    }

    db.prepare("DELETE FROM demo_activity_cancellations WHERE workspace_id = ? AND shift_id = ?")
      .run(workspaceId, shiftId);
    db.prepare("DELETE FROM demo_attendance_audit WHERE workspace_id = ? AND shift_id = ?")
      .run(workspaceId, shiftId);
    db.prepare("DELETE FROM demo_activity_shifts WHERE workspace_id = ? AND id = ?")
      .run(workspaceId, shiftId);

    return { ok: true, shiftId };
  });
}

export function setActivityStatus(
  workspaceId: string,
  activityId: string,
  status: ActivityStatus,
  _actorId: string,
):
  | { ok: true; activityId: string; status: ActivityStatus }
  | { ok: false; error: "invalid_status" | "missing_activity" | "no_valid_shifts" } {
  if (!isActivityStatus(status)) return { ok: false, error: "invalid_status" };

  return writeTransaction(() => {
    const exists = db.prepare(
      "SELECT 1 FROM demo_activities WHERE workspace_id = ? AND id = ?",
    ).get(workspaceId, activityId);
    if (!exists) return { ok: false, error: "missing_activity" };

    if (status === "published") {
      const validShifts = db.prepare(`
        SELECT COUNT(*) AS count
        FROM demo_activity_shifts
        WHERE workspace_id = ? AND activity_id = ? AND ends_at > starts_at AND capacity > 0
      `).get(workspaceId, activityId) as { count: number };
      if (validShifts.count === 0) return { ok: false, error: "no_valid_shifts" };
    }

    db.prepare(`
      UPDATE demo_activities SET status = ? WHERE workspace_id = ? AND id = ?
    `).run(status, workspaceId, activityId);

    return { ok: true, activityId, status };
  });
}

// ---------------------------------------------------------------------------
// 3. Admin Opportunities Management (RF-08, RF-15, CA-05)
// ---------------------------------------------------------------------------

export function listAdminOpportunities(workspaceId: string): Opportunity[] {
  seedOpportunities(workspaceId);
  const rows = db.prepare(`
    SELECT
      id, type, title, organization, description, requirements, location, modality,
      lead, published_at AS publishedAt, deadline, application_url AS applicationUrl,
      contact_email AS contactEmail, image_url AS imageUrl, image_alt AS imageAlt,
      info_url AS infoUrl, status
    FROM demo_opportunities
    WHERE workspace_id = ?
    ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
      published_at DESC, id ASC
  `).all(workspaceId) as unknown as Omit<Opportunity, "bookmarked">[];

  return rows.map((row) => ({ ...row, bookmarked: false }));
}

export function createAdminOpportunity(
  workspaceId: string,
  input: CreateOpportunityInput,
): OpportunityResult {
  return createOpportunity(workspaceId, input);
}

export function setAdminOpportunityStatus(
  workspaceId: string,
  opportunityId: string,
  status: OpportunityStatus,
): OpportunityResult {
  return updateOpportunityStatus(workspaceId, opportunityId, status);
}

// ---------------------------------------------------------------------------
// 4. General Admin: Metrics, Accounts & Deletion Requests (RF-01, RF-15, RF-16)
// ---------------------------------------------------------------------------

export function getAdminMetrics(workspaceId: string): AdminMetrics {
  listShifts(workspaceId);

  const accountCounts = db.prepare(`
    SELECT
      COUNT(*) AS totalAccounts,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeAccounts,
      SUM(CASE WHEN status = 'deactivated' THEN 1 ELSE 0 END) AS deactivatedAccounts
    FROM demo_accounts
    WHERE workspace_id = ? AND verified_at IS NOT NULL
  `).get(workspaceId) as {
    totalAccounts: number;
    activeAccounts: number | null;
    deactivatedAccounts: number | null;
  };

  const pendingDeletions = db.prepare(`
    SELECT COUNT(*) AS count
    FROM demo_deletion_requests
    WHERE workspace_id = ? AND status IN ('pending', 'in_review')
  `).get(workspaceId) as { count: number };

  const shiftRows = db.prepare(`
    SELECT
      shift.id AS shiftId,
      shift.activity_id AS activityId,
      activity.title AS activityTitle,
      activity.status AS activityStatus,
      shift.name AS shiftName,
      shift.starts_at AS startsAt,
      shift.ends_at AS endsAt,
      shift.capacity,
      COUNT(reservation.person_id) AS reservedCount,
      SUM(CASE WHEN reservation.attended_at IS NOT NULL THEN 1 ELSE 0 END) AS attendedCount
    FROM demo_activity_shifts AS shift
    JOIN demo_activities AS activity
      ON activity.workspace_id = shift.workspace_id AND activity.id = shift.activity_id
    LEFT JOIN demo_activity_reservations AS reservation
      ON reservation.workspace_id = shift.workspace_id AND reservation.shift_id = shift.id
    WHERE shift.workspace_id = ?
    GROUP BY shift.workspace_id, shift.id
    ORDER BY shift.starts_at, shift.id
  `).all(workspaceId) as Array<Omit<AdminShiftMetric, "attendedCount"> & { attendedCount: number | null }>;

  return {
    totalAccounts: accountCounts.totalAccounts,
    activeAccounts: accountCounts.activeAccounts ?? 0,
    deactivatedAccounts: accountCounts.deactivatedAccounts ?? 0,
    pendingDeletionRequests: pendingDeletions.count,
    shifts: shiftRows.map((row) => ({ ...row, attendedCount: row.attendedCount ?? 0 })),
  };
}

export function searchAccounts(
  workspaceId: string,
  filters: AccountSearchFilters = {},
): AdminAccountSummary[] {
  const rows = db.prepare(`
    SELECT
      a.id,
      a.first_name AS firstName,
      a.last_name AS lastName,
      a.email,
      a.role,
      a.degree,
      a.course,
      a.status,
      a.verified_at AS verifiedAt,
      COUNT(r.shift_id) AS reservationCount,
      SUM(CASE WHEN r.attended_at IS NOT NULL THEN 1 ELSE 0 END) AS attendedCount
    FROM demo_accounts AS a
    LEFT JOIN demo_activity_reservations AS r
      ON r.workspace_id = a.workspace_id AND r.person_id = a.id
    WHERE a.workspace_id = ? AND a.verified_at IS NOT NULL
    GROUP BY a.workspace_id, a.id
    ORDER BY a.first_name, a.last_name, a.id
  `).all(workspaceId) as Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    role: "student" | "organizer";
    degree: string | null;
    course: string | null;
    status: AccountStatus;
    verifiedAt: number | null;
    reservationCount: number;
    attendedCount: number | null;
  }>;

  const queryNeedle = (filters.query ?? "").trim().toLowerCase();
  const degreeNeedle = (filters.degree ?? "").trim().toLowerCase();
  const courseNeedle = (filters.course ?? "").trim().toLowerCase();
  const statusFilter = filters.status === "active" || filters.status === "deactivated" ? filters.status : "";
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
      email: row.email ?? syntheticEmailFor(row.role),
      role: row.role,
      degree: row.degree ?? "",
      course: row.course ?? "",
      status: row.status,
      capabilities: readAccountCapabilities(workspaceId, row.id),
      reservationCount: row.reservationCount,
      attendedCount: row.attendedCount ?? 0,
      verifiedAt: row.verifiedAt,
    }))
    .filter((account) => {
      if (queryNeedle) {
        const matchesQuery =
          account.name.toLowerCase().includes(queryNeedle) ||
          account.email.toLowerCase().includes(queryNeedle);
        if (!matchesQuery) return false;
      }
      if (degreeNeedle && !account.degree.toLowerCase().includes(degreeNeedle)) return false;
      if (courseNeedle && !account.course.toLowerCase().includes(courseNeedle)) return false;
      if (statusFilter && account.status !== statusFilter) return false;
      if (participationFilter === "yes" && account.reservationCount === 0) return false;
      if (participationFilter === "no" && account.reservationCount > 0) return false;
      return true;
    });
}

export function getAccountAdminDetail(
  workspaceId: string,
  accountId: string,
): AdminAccountDetail | null {
  const row = db.prepare(`
    SELECT
      id, first_name AS firstName, last_name AS lastName, email, role,
      degree, course, status, privacy_version AS privacyVersion,
      privacy_accepted_at AS privacyAcceptedAt, verified_at AS verifiedAt
    FROM demo_accounts
    WHERE workspace_id = ? AND id = ?
  `).get(workspaceId, accountId) as {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    role: "student" | "organizer";
    degree: string | null;
    course: string | null;
    status: AccountStatus;
    privacyVersion: string | null;
    privacyAcceptedAt: number | null;
    verifiedAt: number | null;
  } | undefined;

  if (!row) return null;

  const reservations = db.prepare(`
    SELECT
      r.shift_id AS shiftId,
      shift.name AS shiftName,
      activity.id AS activityId,
      activity.title AS activityTitle,
      shift.starts_at AS startsAt,
      shift.ends_at AS endsAt,
      CASE WHEN r.attended_at IS NULL THEN 'booked' ELSE 'attended' END AS status,
      r.reserved_at AS reservedAt,
      r.attended_at AS attendedAt
    FROM demo_activity_reservations AS r
    JOIN demo_activity_shifts AS shift
      ON shift.workspace_id = r.workspace_id AND shift.id = r.shift_id
    JOIN demo_activities AS activity
      ON activity.workspace_id = shift.workspace_id AND activity.id = shift.activity_id
    WHERE r.workspace_id = ? AND r.person_id = ?
    ORDER BY shift.starts_at DESC, shift.id
  `).all(workspaceId, accountId) as AdminAccountDetail["reservations"];

  const capabilityAudit = db.prepare(`
    SELECT
      audit.id,
      audit.capability,
      audit.action,
      audit.actor_id AS actorId,
      COALESCE(trim(actor.first_name || ' ' || actor.last_name), audit.actor_id) AS actorName,
      audit.created_at AS createdAt
    FROM demo_capability_audit AS audit
    LEFT JOIN demo_accounts AS actor
      ON actor.workspace_id = audit.workspace_id AND actor.id = audit.actor_id
    WHERE audit.workspace_id = ? AND audit.target_account_id = ?
    ORDER BY audit.created_at DESC, audit.rowid DESC
  `).all(workspaceId, accountId) as AdminAccountDetail["capabilityAudit"];

  const deletionRequests = db.prepare(`
    SELECT id, status, created_at AS createdAt, resolved_at AS resolvedAt
    FROM demo_deletion_requests
    WHERE workspace_id = ? AND account_id = ?
    ORDER BY created_at DESC, rowid DESC
  `).all(workspaceId, accountId) as AdminAccountDetail["deletionRequests"];

  return {
    id: row.id,
    name: formatName(row.firstName, row.lastName),
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email ?? syntheticEmailFor(row.role),
    role: row.role,
    degree: row.degree ?? "",
    course: row.course ?? "",
    status: row.status,
    privacyVersion: row.privacyVersion,
    privacyAcceptedAt: row.privacyAcceptedAt,
    verifiedAt: row.verifiedAt,
    capabilities: readAccountCapabilities(workspaceId, accountId),
    reservations: reservations.map((item) => ({ ...item })),
    capabilityAudit: capabilityAudit.map((item) => ({ ...item })),
    deletionRequests: deletionRequests.map((item) => ({ ...item })),
  };
}

function mapDeletionRequestRow(row: {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: "student" | "organizer";
  accountStatus: AccountStatus;
  status: DeletionRequestStatus;
  reason: string;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  createdAt: number;
  resolvedAt: number | null;
}): AdminDeletionRequest {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: formatName(row.firstName, row.lastName),
    accountEmail: row.email ?? syntheticEmailFor(row.role),
    accountStatus: row.accountStatus,
    status: row.status,
    reason: row.reason,
    resolutionNote: row.resolutionNote ?? null,
    resolvedBy: row.resolvedBy ?? null,
    resolvedByName: row.resolvedByName?.trim() || row.resolvedBy || null,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? null,
  };
}

const deletionRequestSelect = `
  SELECT
    req.id,
    req.account_id AS accountId,
    a.first_name AS firstName,
    a.last_name AS lastName,
    a.email,
    a.role,
    a.status AS accountStatus,
    req.status,
    req.reason,
    req.resolution_note AS resolutionNote,
    req.resolved_by AS resolvedBy,
    trim(resolver.first_name || ' ' || resolver.last_name) AS resolvedByName,
    req.created_at AS createdAt,
    req.resolved_at AS resolvedAt
  FROM demo_deletion_requests AS req
  JOIN demo_accounts AS a
    ON a.workspace_id = req.workspace_id AND a.id = req.account_id
  LEFT JOIN demo_accounts AS resolver
    ON resolver.workspace_id = req.workspace_id AND resolver.id = req.resolved_by
`;

export function listDeletionRequests(workspaceId: string): AdminDeletionRequest[] {
  const rows = db.prepare(`
    ${deletionRequestSelect}
    WHERE req.workspace_id = ?
    ORDER BY
      CASE req.status WHEN 'pending' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
      req.created_at DESC,
      req.rowid DESC
  `).all(workspaceId) as Parameters<typeof mapDeletionRequestRow>[0][];

  return rows.map(mapDeletionRequestRow);
}

export function getDeletionRequest(workspaceId: string, requestId: string): AdminDeletionRequest | null {
  const row = db.prepare(`
    ${deletionRequestSelect}
    WHERE req.workspace_id = ? AND req.id = ?
  `).get(workspaceId, requestId) as Parameters<typeof mapDeletionRequestRow>[0] | undefined;

  return row ? mapDeletionRequestRow(row) : null;
}

export function resolveDeletionRequest(
  workspaceId: string,
  requestId: string,
  status: "in_review" | "resolved",
  resolutionNote: string,
  actorId: string,
  now = Date.now(),
): ResolveDeletionRequestResult {
  if (status !== "in_review" && status !== "resolved") {
    return { ok: false, error: "invalid_status" };
  }
  const trimmedActor = actorId.trim();
  if (!trimmedActor) return { ok: false, error: "missing_actor" };

  const trimmedNote = resolutionNote.trim();
  if (status === "resolved") {
    if (!trimmedNote || trimmedNote.length > 2000) {
      return { ok: false, error: "missing_resolution_note" };
    }
    if (!Number.isFinite(now)) {
      return { ok: false, error: "invalid_date" };
    }
  }

  return writeTransaction(() => {
    const existing = db.prepare(`
      SELECT status, resolution_note AS resolutionNote
      FROM demo_deletion_requests
      WHERE workspace_id = ? AND id = ?
    `).get(workspaceId, requestId) as { status: DeletionRequestStatus; resolutionNote: string | null } | undefined;

    if (!existing) return { ok: false, error: "missing" };
    if (existing.status === "resolved") return { ok: false, error: "already_resolved" };

    if (status === "resolved") {
      db.prepare(`
        UPDATE demo_deletion_requests
        SET status = 'resolved', resolution_note = ?, resolved_by = ?, resolved_at = ?
        WHERE workspace_id = ? AND id = ?
      `).run(trimmedNote, trimmedActor, now, workspaceId, requestId);
    } else {
      db.prepare(`
        UPDATE demo_deletion_requests
        SET status = 'in_review', resolution_note = ?
        WHERE workspace_id = ? AND id = ?
      `).run(trimmedNote || existing.resolutionNote, workspaceId, requestId);
    }

    const updated = getDeletionRequest(workspaceId, requestId)!;
    return { ok: true, request: updated };
  });
}

// ---------------------------------------------------------------------------
// 5. Talent Consultation (RF-01, RF-06, CA-01, CA-04) — separate capability
// ---------------------------------------------------------------------------

function readLatestDissemination(
  workspaceId: string,
  accountId: string,
): { granted: boolean; decidedAt: number | null; policyVersion: string | null } {
  const row = db.prepare(`
    SELECT granted, decided_at AS decidedAt, policy_version AS policyVersion
    FROM demo_talent_dissemination_decisions
    WHERE workspace_id = ? AND account_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(workspaceId, accountId) as { granted: number; decidedAt: number; policyVersion: string } | undefined;

  return {
    granted: row?.granted === 1,
    decidedAt: row?.decidedAt ?? null,
    policyVersion: row?.policyVersion ?? null,
  };
}

export function searchTalentProfiles(workspaceId: string, query = ""): TalentProfileSummary[] {
  const rows = db.prepare(`
    SELECT
      tp.account_id AS accountId,
      a.first_name AS firstName,
      a.last_name AS lastName,
      a.email,
      a.role,
      a.degree,
      a.course,
      a.status,
      tp.university,
      tp.graduation_year AS graduationYear,
      tp.headline,
      tp.experiences_summary AS experiencesSummary,
      tp.featured_project AS featuredProject,
      tp.skills_json AS skillsJson,
      tp.tools_json AS toolsJson,
      tp.interests_json AS interestsJson,
      tp.sectors_json AS sectorsJson,
      tp.languages_json AS languagesJson,
      tp.updated_at AS updatedAt,
      COUNT(tl.position) AS linksCount
    FROM demo_talent_profiles AS tp
    JOIN demo_accounts AS a
      ON a.workspace_id = tp.workspace_id AND a.id = tp.account_id
    LEFT JOIN demo_talent_links AS tl
      ON tl.workspace_id = tp.workspace_id AND tl.account_id = tp.account_id
    WHERE tp.workspace_id = ?
    GROUP BY tp.workspace_id, tp.account_id
    ORDER BY tp.updated_at DESC, a.first_name, a.last_name
  `).all(workspaceId) as Array<{
    accountId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    role: "student" | "organizer";
    degree: string | null;
    course: string | null;
    status: AccountStatus;
    university: string;
    graduationYear: number | null;
    headline: string;
    experiencesSummary: string;
    featuredProject: string;
    skillsJson: string;
    toolsJson: string;
    interestsJson: string;
    sectorsJson: string;
    languagesJson: string;
    updatedAt: number;
    linksCount: number;
  }>;

  const needle = query.trim().toLowerCase();

  return rows
    .map((row) => {
      const skills = JSON.parse(row.skillsJson) as string[];
      const tools = JSON.parse(row.toolsJson) as string[];
      const interests = JSON.parse(row.interestsJson) as string[];
      const sectors = JSON.parse(row.sectorsJson) as string[];
      const languages = JSON.parse(row.languagesJson) as string[];
      const name = formatName(row.firstName, row.lastName);
      const email = row.email ?? syntheticEmailFor(row.role);
      const degree = row.degree ?? "";
      const dissemination = readLatestDissemination(workspaceId, row.accountId);

      return {
        summary: {
          accountId: row.accountId,
          name,
          email,
          degree,
          course: row.course ?? "",
          status: row.status,
          university: row.university,
          graduationYear: row.graduationYear,
          headline: row.headline,
          skills,
          tools,
          interests,
          sectors,
          languages,
          disseminationGranted: dissemination.granted,
          linksCount: row.linksCount,
          updatedAt: row.updatedAt,
        } satisfies TalentProfileSummary,
        searchable: [
          name,
          email,
          degree,
          row.university,
          row.headline,
          row.experiencesSummary,
          row.featuredProject,
          ...skills,
          ...tools,
          ...interests,
          ...sectors,
          ...languages,
        ]
          .join(" ")
          .toLowerCase(),
      };
    })
    .filter((entry) => !needle || entry.searchable.includes(needle))
    .map((entry) => entry.summary);
}

export function getTalentAdminDetail(workspaceId: string, accountId: string): TalentAdminDetail | null {
  const row = db.prepare(`
    SELECT
      tp.account_id AS accountId,
      a.first_name AS firstName,
      a.last_name AS lastName,
      a.email,
      a.role,
      a.degree,
      a.course,
      a.status,
      tp.university,
      tp.graduation_year AS graduationYear,
      tp.headline,
      tp.experiences_summary AS experiencesSummary,
      tp.featured_project AS featuredProject,
      tp.skills_json AS skillsJson,
      tp.tools_json AS toolsJson,
      tp.interests_json AS interestsJson,
      tp.sectors_json AS sectorsJson,
      tp.languages_json AS languagesJson,
      tp.updated_at AS updatedAt
    FROM demo_talent_profiles AS tp
    JOIN demo_accounts AS a
      ON a.workspace_id = tp.workspace_id AND a.id = tp.account_id
    WHERE tp.workspace_id = ? AND tp.account_id = ?
  `).get(workspaceId, accountId) as {
    accountId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    role: "student" | "organizer";
    degree: string | null;
    course: string | null;
    status: AccountStatus;
    university: string;
    graduationYear: number | null;
    headline: string;
    experiencesSummary: string;
    featuredProject: string;
    skillsJson: string;
    toolsJson: string;
    interestsJson: string;
    sectorsJson: string;
    languagesJson: string;
    updatedAt: number;
  } | undefined;

  if (!row) return null;

  const links = db.prepare(`
    SELECT kind, label, url
    FROM demo_talent_links
    WHERE workspace_id = ? AND account_id = ?
    ORDER BY position ASC
  `).all(workspaceId, accountId) as TalentLink[];

  const dissemination = readLatestDissemination(workspaceId, accountId);

  return {
    accountId: row.accountId,
    name: formatName(row.firstName, row.lastName),
    email: row.email ?? syntheticEmailFor(row.role),
    degree: row.degree ?? "",
    course: row.course ?? "",
    status: row.status,
    university: row.university,
    graduationYear: row.graduationYear,
    headline: row.headline,
    experiencesSummary: row.experiencesSummary,
    featuredProject: row.featuredProject,
    skills: JSON.parse(row.skillsJson) as string[],
    tools: JSON.parse(row.toolsJson) as string[],
    interests: JSON.parse(row.interestsJson) as string[],
    sectors: JSON.parse(row.sectorsJson) as string[],
    languages: JSON.parse(row.languagesJson) as string[],
    links: links.map((link) => ({ ...link })),
    linksCount: links.length,
    disseminationGranted: dissemination.granted,
    disseminationDecidedAt: dissemination.decidedAt,
    disseminationPolicyVersion: dissemination.policyVersion,
    updatedAt: row.updatedAt,
  };
}
