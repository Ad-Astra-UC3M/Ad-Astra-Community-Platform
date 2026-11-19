"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../../../demo/db";
import { ALL_CAPABILITIES, type AdminCapability, SessionStore } from "../../../demo/session-store";
import { requireCapability } from "../access";

const store = new SessionStore(db);
const validCapabilities = new Set<string>(ALL_CAPABILITIES);

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function toggleAccountCapabilityAction(form: FormData) {
  const admin = await requireCapability("general_admin");
  const targetAccountId = readField(form, "accountId");
  const capability = readField(form, "capability");
  const enabled = readField(form, "enabled") === "true";

  if (!targetAccountId || !validCapabilities.has(capability)) {
    redirect("/admin/accounts");
  }

  store.setCapability(
    admin.workspaceId,
    targetAccountId,
    capability as AdminCapability,
    enabled,
    admin.id,
  );
  revalidatePath(`/admin/accounts/${encodeURIComponent(targetAccountId)}`);
  revalidatePath("/admin/accounts");
  revalidatePath("/admin");

  const status = enabled ? "capability_granted" : "capability_revoked";
  redirect(`/admin/accounts/${encodeURIComponent(targetAccountId)}?status=${status}`);
}

export async function setAccountStatusAction(form: FormData) {
  const admin = await requireCapability("general_admin");
  const targetAccountId = readField(form, "accountId");
  const rawStatus = readField(form, "status");
  const nextStatus = rawStatus === "deactivated" ? "deactivated" : "active";

  if (!targetAccountId) {
    redirect("/admin/accounts");
  }

  const updated = store.setAccountStatus(admin.workspaceId, targetAccountId, nextStatus, admin.id);
  revalidatePath(`/admin/accounts/${encodeURIComponent(targetAccountId)}`);
  revalidatePath("/admin/accounts");
  revalidatePath("/admin");

  const status = updated ? `account_${nextStatus}` : "missing";
  redirect(`/admin/accounts/${encodeURIComponent(targetAccountId)}?status=${status}`);
}
