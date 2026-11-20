import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getDb, type AppDb, type AppDbOrTx } from "../../db/client";
import { adminAuditLogs, deletionRequests, profiles, type AccountStatus, type DeletionStatus } from "../../db/schema";
import { formatName, isUuid, profileExists } from "./identity";

const deletionReasonSchema = z.string().trim().max(1000);
const resolutionNoteSchema = z.string().trim().min(1).max(2000);

export interface DeletionRequest {
  id: string;
  personId: string;
  status: DeletionStatus;
  reason: string;
  resolutionNote: string | null;
  resolvedBy: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export type RequestDeletionResult =
  | { ok: true; created: boolean; request: DeletionRequest }
  | { ok: false; error: "missing" | "reason_too_long" };

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

async function resolveDb(db?: AppDb): Promise<AppDb> {
  return db ?? getDb();
}

function getPgErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  if ("cause" in error) {
    return getPgErrorCode((error as { cause?: unknown }).cause);
  }
  return undefined;
}

function mapDeletionRequest(
  row: typeof deletionRequests.$inferSelect,
): DeletionRequest {
  return {
    id: row.id,
    personId: row.personId,
    status: row.status,
    reason: row.reason ?? "",
    resolutionNote: row.resolutionNote ?? null,
    resolvedBy: row.resolvedBy ?? null,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? null,
  };
}

export async function requestAccountDeletion(
  personId: string,
  reason = "",
  now: Date = new Date(),
  db?: AppDb,
): Promise<RequestDeletionResult> {
  if (!isUuid(personId)) return { ok: false, error: "missing" };

  const parsedReason = deletionReasonSchema.safeParse(reason);
  if (!parsedReason.success) {
    return { ok: false, error: "reason_too_long" };
  }

  const database = await resolveDb(db);

  try {
    return await database.transaction(async (tx) => {
      const [profile] = await tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, personId))
        .for("update");
      if (!profile) return { ok: false, error: "missing" };

      const [existing] = await tx
        .select()
        .from(deletionRequests)
        .where(
          and(
            eq(deletionRequests.personId, personId),
            inArray(deletionRequests.status, ["pending", "in_review"]),
          ),
        )
        .limit(1);

      if (existing) {
        return {
          ok: true,
          created: false,
          request: mapDeletionRequest(existing),
        };
      }

      const [inserted] = await tx
        .insert(deletionRequests)
        .values({
          personId,
          status: "pending",
          reason: parsedReason.data || null,
          createdAt: now,
        })
        .returning();

      return {
        ok: true,
        created: true,
        request: mapDeletionRequest(inserted),
      };
    });
  } catch (error) {
    if (getPgErrorCode(error) === "23505") {
      const [existing] = await database
        .select()
        .from(deletionRequests)
        .where(
          and(
            eq(deletionRequests.personId, personId),
            inArray(deletionRequests.status, ["pending", "in_review"]),
          ),
        )
        .limit(1);
      if (existing) {
        return {
          ok: true,
          created: false,
          request: mapDeletionRequest(existing),
        };
      }
    }
    throw error;
  }
}

export async function getMyDeletionRequest(
  requesterId: string,
  targetPersonId: string = requesterId,
  db?: AppDb,
): Promise<DeletionRequest | null> {
  if (requesterId !== targetPersonId) return null;
  if (!isUuid(requesterId)) return null;
  const database = await resolveDb(db);

  const [row] = await database
    .select()
    .from(deletionRequests)
    .where(eq(deletionRequests.personId, requesterId))
    .orderBy(
      sql`CASE WHEN ${deletionRequests.status} IN ('pending', 'in_review') THEN 0 ELSE 1 END`,
      desc(deletionRequests.createdAt),
      desc(deletionRequests.id),
    )
    .limit(1);

  return row ? mapDeletionRequest(row) : null;
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
