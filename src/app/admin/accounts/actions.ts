"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AccountStatus } from "../../../db/schema";
import { changeAccountCapability, changeAccountStatus } from "../../../server/accounts/operations";

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function toggleAccountCapabilityAction(form: FormData) {
  const targetAccountId = readField(form, "accountId");
  const capability = readField(form, "capability");
  const enabled = readField(form, "enabled") === "true";

  const result = await changeAccountCapability(targetAccountId, capability, enabled);
  if (!result) redirect("/admin/accounts");
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
  const targetAccountId = readField(form, "accountId");
  const rawStatus = readField(form, "status");
  const nextStatus: AccountStatus = rawStatus === "deactivated" ? "deactivated" : "active";

  const result = await changeAccountStatus(targetAccountId, nextStatus);
  if (!result) redirect("/admin/accounts");
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
