import "server-only";

import { listShifts } from "../activities/portal-data";
import { requireAdminAny } from "../auth/access";
import { getAccountAdminDetail, getAdminMetrics, searchAccounts, type AccountSearchFilters } from "./repository";
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

export async function loadAdminDashboard() {
  const user = await requireAdminAny();
  const capabilities = user.capabilities;
  const [metrics, shifts] = await Promise.all([
    capabilities.includes("general_admin") ? getAdminMetrics() : null,
    capabilities.includes("attendance_validation") ? listShifts() : [],
  ]);
  return { capabilities, metrics, shifts };
}

export async function searchAdminAccounts(filters: AccountSearchFilters) {
  await requireCapability("general_admin");
  return searchAccounts(filters);
}

export async function getAdminAccount(id: string) {
  await requireCapability("general_admin");
  return getAccountAdminDetail(id);
}
