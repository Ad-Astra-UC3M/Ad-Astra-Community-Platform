"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveDeletionRequest } from "../../../server/repositories/admin";
import { requireCapability } from "../access";

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function resolveDeletionRequestAction(form: FormData) {
  const admin = await requireCapability("general_admin");
  const requestId = readField(form, "requestId");
  const status = readField(form, "status") === "resolved" ? "resolved" : "in_review";
  const resolutionNote = readField(form, "resolutionNote");

  if (!requestId) {
    redirect("/admin/deletion-requests");
  }

  const result = await resolveDeletionRequest(
    requestId,
    status,
    resolutionNote,
    admin.personId,
  );

  revalidatePath(`/admin/deletion-requests/${encodeURIComponent(requestId)}`);
  revalidatePath("/admin/deletion-requests");
  revalidatePath("/admin");
  revalidatePath("/profile/privacy");

  if (!result.ok) {
    redirect(`/admin/deletion-requests/${encodeURIComponent(requestId)}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/admin/deletion-requests/${encodeURIComponent(requestId)}?status=${status}`);
}
