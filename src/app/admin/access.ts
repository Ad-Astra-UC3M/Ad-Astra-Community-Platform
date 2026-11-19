import { notFound } from "next/navigation";
import {
  type AuthUser,
  type CapabilityCode,
  currentUser,
} from "../../lib/auth/session";

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

export async function requireOrganizer(): Promise<AuthUser> {
  return requireCapability("attendance_validation");
}
