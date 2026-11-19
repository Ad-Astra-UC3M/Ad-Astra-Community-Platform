import path from "node:path";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { closeDb, getDb, type AppDb } from "../src/db/client";
import {
  accountCapabilities,
  adminAuditLogs,
  profiles,
} from "../src/db/schema";

export interface BootstrapAdminResult {
  profileId: string;
  email: string;
  granted: boolean;
  alreadyHadCapability: boolean;
}

export async function bootstrapAdmin(
  db: AppDb,
  rawEmail: string,
): Promise<BootstrapAdminResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) {
    throw new Error("An email address is required to bootstrap general_admin.");
  }

  return db.transaction(async (tx) => {
    const [profile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.email, email))
      .for("update");

    if (!profile) {
      throw new Error(`Profile not found for email: ${email}`);
    }
    if (profile.status !== "active") {
      throw new Error(`Profile must be active to grant general_admin: ${email}`);
    }
    if (!profile.authUserId) {
      throw new Error(
        `Profile must be linked to Neon Auth (auth_user_id is null): ${email}`,
      );
    }
    if (!profile.emailVerifiedAt) {
      throw new Error(
        `Profile email must be verified (email_verified_at is null): ${email}`,
      );
    }

    const inserted = await tx
      .insert(accountCapabilities)
      .values({
        profileId: profile.id,
        capabilityCode: "general_admin",
        grantedBy: null,
      })
      .onConflictDoNothing({
        target: [
          accountCapabilities.profileId,
          accountCapabilities.capabilityCode,
        ],
      })
      .returning();

    if (inserted.length === 0) {
      return {
        profileId: profile.id,
        email: profile.email,
        granted: false,
        alreadyHadCapability: true,
      };
    }

    await tx.insert(adminAuditLogs).values({
      actorProfileId: null,
      targetType: "profile",
      targetId: profile.id,
      action: "capability_granted",
      result: "success",
      metadata: {
        capability: "general_admin",
        source: "bootstrap",
      },
    });

    return {
      profileId: profile.id,
      email: profile.email,
      granted: true,
      alreadyHadCapability: false,
    };
  });
}

function isDirectCliInvocation(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(path.resolve(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isDirectCliInvocation()) {
  const emailArg = process.argv[2];
  if (!emailArg) {
    console.error("Usage: tsx scripts/bootstrap-admin.ts <uc3m-email>");
    process.exit(1);
  }

  getDb()
    .then((db) => bootstrapAdmin(db, emailArg))
    .then((result) => {
      if (result.granted) {
        console.log(
          `Granted general_admin via bootstrap to ${result.email} (${result.profileId}).`,
        );
      } else {
        console.log(
          `${result.email} (${result.profileId}) already has general_admin; no changes made.`,
        );
      }
    })
    .catch((error: unknown) => {
      console.error(
        "Bootstrap admin failed:",
        error instanceof Error ? error.message : error,
      );
      process.exitCode = 1;
    })
    .finally(() => closeDb().catch(() => undefined));
}
