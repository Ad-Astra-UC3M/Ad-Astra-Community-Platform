"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type AccountStatus,
  isCapabilityCode,
  revokeUserSessions,
} from "../../../lib/auth/session";
import {
  setProfileCapability,
  setProfileStatus,
} from "../../../server/repositories/admin";
import { requireCapability } from "../access";

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function toggleAccountCapabilityAction(form: FormData) {
  const admin = await requireCapability("general_admin");
  const targetAccountId = readField(form, "accountId");
  const capability = readField(form, "capability");
  const enabled = readField(form, "enabled") === "true";

  if (!targetAccountId || !isCapabilityCode(capability)) {
    redirect("/admin/accounts");
  }

  const result = await setProfileCapability(
    targetAccountId,
    capability,
    enabled,
    admin.personId,
  );
  revalidatePath(`/admin/accounts/${encodeURIComponent(targetAccountId)}`);
  revalidatePath("/admin/accounts");
  revalidatePath("/admin");

  if (!result.ok) {
    redirect(
      `/admin/accounts/${encodeURIComponent(targetAccountId)}?error=${encodeURIComponent(result.error)}`,
    );
  }

  const status = enabled ? "capability_granted" : "capability_revoked";
  redirect(`/admin/accounts/${encodeURIComponent(targetAccountId)}?status=${status}`);
}

export async function setAccountStatusAction(form: FormData) {
  const admin = await requireCapability("general_admin");
  const targetAccountId = readField(form, "accountId");
  const rawStatus = readField(form, "status");
  const nextStatus: AccountStatus = rawStatus === "deactivated" ? "deactivated" : "active";

  if (!targetAccountId) {
    redirect("/admin/accounts");
  }

  const result = await setProfileStatus(
    targetAccountId,
    nextStatus,
    admin.personId,
    revokeUserSessions,
  );
  revalidatePath(`/admin/accounts/${encodeURIComponent(targetAccountId)}`);
  revalidatePath("/admin/accounts");
  revalidatePath("/admin");

  if (!result.ok) {
    redirect(
      `/admin/accounts/${encodeURIComponent(targetAccountId)}?error=${encodeURIComponent(result.error)}`,
    );
  }

  redirect(`/admin/accounts/${encodeURIComponent(targetAccountId)}?status=account_${nextStatus}`);
}
