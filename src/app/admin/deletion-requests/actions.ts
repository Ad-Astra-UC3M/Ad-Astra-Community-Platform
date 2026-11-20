"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reviewDeletionRequest } from "../../../server/profiles/operations";

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

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
