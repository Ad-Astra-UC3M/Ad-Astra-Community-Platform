import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getDb } from "../../db/client";
import type { CapabilityCode } from "../../db/schema";
import { getAuthProvider } from "./neon-auth";
import { resolveCurrentUser, type AuthUser } from "./service";
import { sanitizeNextPath } from "./uc3m";

export async function currentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  if (jar.getAll().length === 0) {
    return null;
  }
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  return resolveCurrentUser(db, authProvider);
}

export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const user = await currentUser();
  if (!user) {
    redirect(
      nextPath
        ? "/sign-in?next=" +
            encodeURIComponent(sanitizeNextPath(nextPath, "/home"))
        : "/sign-in",
    );
  }
  return user;
}

export async function revokeUserSessions(authUserId: string): Promise<void> {
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  await authProvider.revokeUserSessions(authUserId);
}

export async function requireAdminAny(): Promise<AuthUser> {
  const user = await currentUser();
  if (!user || user.status !== "active" || user.capabilities.length === 0) {
    notFound();
  }
  return user;
}

export async function requireCapability(
  capability: CapabilityCode,
): Promise<AuthUser> {
  const user = await currentUser();
  if (
    !user ||
    user.status !== "active" ||
    !user.capabilities.includes(capability)
  ) {
    notFound();
  }
  return user;
}
