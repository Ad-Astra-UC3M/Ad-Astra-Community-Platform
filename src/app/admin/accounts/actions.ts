/**
 * Server Actions de la ficha administrativa de cuenta. Procesan el FormData de los botones de
 * estado y permisos, delegan la autorización y revalidan las rutas donde se muestran estos
 * datos.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AccountStatus } from "../../../db/schema";
import { changeAccountCapability, changeAccountStatus } from "../../../server/accounts/operations";

/**
 * Normaliza el texto de los campos que usan las dos acciones de cuentas.
 *
 * @param form - Campos que Next.js recibe al enviar el formulario.
 * @param name - Nombre del control cuyo valor se extrae.
 * @returns Texto recortado o cadena vacía si falta o no es texto.
 */
function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Server Action de los botones de concesión y revocación de AdminAccountDetailPage. Delega en
 * changeAccountCapability y revalida ficha, listado y panel.
 *
 * @param form - Incluye accountId, capability y enabled. Solo el texto true solicita conceder.
 * @returns Redirige al listado si no puede comenzar el cambio, o a la ficha con el resultado.
 */
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

/**
 * Server Action del botón de activación o desactivación de AdminAccountDetailPage. Delega en
 * changeAccountStatus y revalida ficha, listado y panel.
 *
 * @param form - Incluye accountId y status. El valor deactivated desactiva y los demás valores
 *   seleccionan active.
 * @returns Redirige al listado si falta el ID, o a la ficha con el resultado.
 */
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
