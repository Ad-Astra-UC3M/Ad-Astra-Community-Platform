/**
 * Server Action del formulario de tramitación de una solicitud de supresión. Lee el FormData,
 * delega la autorización y el cambio auditado, y actualiza las páginas que lo muestran.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reviewDeletionRequest } from "../../../server/profiles/operations";

/**
 * Recorta los campos que usa resolveDeletionRequestAction.
 *
 * @param form - Campos del formulario de tramitación.
 * @param name - Nombre del control cuyo valor se lee.
 * @returns Texto recortado o cadena vacía si el valor falta o no es texto.
 */
function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Server Action de AdminDeletionRequestDetailPage. Delega en reviewDeletionRequest y revalida
 * detalle, listado, panel y privacidad antes de volver a la ficha.
 *
 * @param form - Incluye requestId, resolutionNote y status. Selecciona resolved para ese texto
 *   exacto e in_review en otro caso.
 * @returns Redirige al listado cuando falta el ID, o al detalle con el estado o código de
 *   error.
 */
export async function resolveDeletionRequestAction(form: FormData) {
  const requestId = readField(form, "requestId");
  const status = readField(form, "status") === "resolved" ? "resolved" : "in_review";
  const resolutionNote = readField(form, "resolutionNote");

  const result = await reviewDeletionRequest(requestId, status, resolutionNote);
  if (!result) redirect("/admin/deletion-requests");

  revalidatePath(`/admin/deletion-requests/${encodeURIComponent(requestId)}`);
  revalidatePath("/admin/deletion-requests");
  revalidatePath("/admin");
  revalidatePath("/profile/privacy");

  if (!result.ok) {
    redirect(`/admin/deletion-requests/${encodeURIComponent(requestId)}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/admin/deletion-requests/${encodeURIComponent(requestId)}?status=${status}`);
}
