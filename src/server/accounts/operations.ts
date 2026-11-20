import type { AccountStatus } from "../../db/schema";
import { requireCapability, revokeUserSessions } from "../auth/access";
import { isCapabilityCode } from "../auth/service";
import { setProfileCapability, setProfileStatus } from "./repository";

export async function changeAccountCapability(
  targetAccountId: string,
  capability: string,
  enabled: boolean,
) {
  const admin = await requireCapability("general_admin");
  if (!targetAccountId || !isCapabilityCode(capability)) return null;
  return setProfileCapability(targetAccountId, capability, enabled, admin.personId);
}

export async function changeAccountStatus(targetAccountId: string, status: AccountStatus) {
  const admin = await requireCapability("general_admin");
  if (!targetAccountId) return null;
  return setProfileStatus(targetAccountId, status, admin.personId, revokeUserSessions);
}
