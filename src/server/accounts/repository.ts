import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getDb, type AppDb, type AppDbOrTx } from "../../db/client";
import {
  ACCOUNT_STATUSES, CAPABILITY_CODES, accountCapabilities, activities,
  adminAuditLogs, deletionRequests, participations, profiles, shifts,
  type AccountStatus, type CapabilityCode, type DeletionStatus,
  type ParticipationStatus, type PublishStatus,
} from "../../db/schema";
import { formatName, isUuid, profileExists } from "../profiles/identity";

const capabilitySchema = z.enum(CAPABILITY_CODES);
const accountStatusSchema = z.enum(ACCOUNT_STATUSES);

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
      error:
        | "invalid_capability"
        | "missing_profile"
        | "missing_actor"
        | "last_general_admin";
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
      error:
        | "invalid_status"
        | "missing_profile"
        | "missing_actor"
        | "last_general_admin";
    };

async function resolveDb(db?: AppDb): Promise<AppDb> {
  return db ?? getDb();
}

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

async function isOnlyActiveGeneralAdminLocked(
  tx: AppDbOrTx,
  targetProfileId: string,
): Promise<boolean> {
  const generalAdminRows = await tx
    .select({
      profileId: accountCapabilities.profileId,
      status: profiles.status,
    })
    .from(accountCapabilities)
    .innerJoin(profiles, eq(profiles.id, accountCapabilities.profileId))
    .where(eq(accountCapabilities.capabilityCode, "general_admin"))
    .orderBy(asc(accountCapabilities.profileId))
    .for("update");

  const targetIsActiveGeneralAdmin = generalAdminRows.some(
    (row) => row.profileId === targetProfileId && row.status === "active",
  );
  if (!targetIsActiveGeneralAdmin) {
    return false;
  }

  return !generalAdminRows.some(
    (row) => row.profileId !== targetProfileId && row.status === "active",
  );
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
    const onlyActiveGeneralAdmin =
      parsedCapability.data === "general_admin" && !enabled
        ? await isOnlyActiveGeneralAdminLocked(tx, targetProfileId)
        : false;

    const [target] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, targetProfileId))
      .for("update");
    if (!target) return { ok: false, error: "missing_profile" };

    if (!(await profileExists(tx, actorProfileId))) {
      return { ok: false, error: "missing_actor" };
    }

    if (onlyActiveGeneralAdmin) {
      return { ok: false, error: "last_general_admin" };
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
    const onlyActiveGeneralAdmin =
      parsedStatus.data === "deactivated"
        ? await isOnlyActiveGeneralAdminLocked(tx, targetProfileId)
        : false;

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

    if (onlyActiveGeneralAdmin) {
      return { ok: false as const, error: "last_general_admin" as const };
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
